"use client";

import { useState, useTransition } from "react";
import {
  PlayCircle,
  Link2,
  Tv2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Eye,
  ThumbsUp,
  BarChart2,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { CampaignPicker } from "@/components/CampaignPicker";
import type { CampaignOption } from "@/components/CampaignPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface YouTubeIngestSuccess {
  status: "success";
  creative: {
    id: string;
    thumbnail_url: string | null;
    view_count: number | null;
    engagement_rate: number | null;
    source_url: string;
  };
  meta: { video_id: string; title: string; channel: string; published_at: string };
}
interface YouTubeIngestError {
  status: "error";
  error: string;
  code: string;
  detail?: string;
}
type SingleResult = YouTubeIngestSuccess | YouTubeIngestError | null;

// Channel bulk result
interface ChannelVideoResult {
  status: "inserted" | "duplicate" | "error";
  source_url: string;
  title: string;
  thumbnail_url?: string | null;
  view_count?: number | null;
  engagement_rate?: number | null;
  creative_id?: string;
  error?: string;
}
interface ChannelIngestSuccess {
  status: "success";
  summary: { inserted: number; duplicates: number; errors: number; channel: string; max_results: number };
  results: ChannelVideoResult[];
}
interface ChannelIngestError {
  status: "error";
  error: string;
  code: string;
}
type ChannelResult = ChannelIngestSuccess | ChannelIngestError | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function fmtRate(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${(r * 100).toFixed(2)}%`;
}

const STATUS_COLOR: Record<ChannelVideoResult["status"], string> = {
  inserted:  "#22d3a0",
  duplicate: "#f59e0b",
  error:     "#f43f5e",
};
const STATUS_LABEL: Record<ChannelVideoResult["status"], string> = {
  inserted:  "Saved",
  duplicate: "Already exists",
  error:     "Failed",
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function InputRow({
  id, icon, value, onChange, placeholder, disabled,
}: {
  id: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "8px",
        padding: "10px 14px",
      }}
    >
      <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{icon}</span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--color-text-primary)",
          fontSize: "13px",
          width: "100%",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--color-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </label>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        color: "var(--color-text-muted)",
        fontSize: "11px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
      {label}
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
    </div>
  );
}

function ErrorBanner({ code, message, detail }: { code: string; message: string; detail?: string }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: "10px",
        padding: "14px",
        background: "rgba(244,63,94,0.08)",
        border: "1px solid rgba(244,63,94,0.2)",
        borderRadius: "10px",
      }}
    >
      <AlertCircle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#f43f5e", marginBottom: "3px" }}>
          {code}
        </p>
        <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{message}</p>
        {detail && (
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px", fontFamily: "monospace" }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface YouTubeIngestFormProps {
  brandId: string;
  brandName?: string;
  /** When opened from a campaign page, pre-locks the campaign so all ingests are auto-tagged. */
  campaignId?: string | null;
  campaignName?: string | null;
}

export function YouTubeIngestForm({ brandId, brandName, campaignId, campaignName }: YouTubeIngestFormProps) {
  // Single video state — seed with locked campaign if provided
  const [videoUrl, setVideoUrl]                 = useState("");
  const [singleCampaign, setSingleCampaign]     = useState<CampaignOption | null>(
    campaignId ? { id: campaignId, name: campaignName ?? "" } : null
  );
  const [singleResult, setSingleResult]         = useState<SingleResult>(null);
  const [singlePending, startSingleTransition]  = useTransition();

  // Channel sync state — seed with locked campaign if provided
  const [channelUrl, setChannelUrl]             = useState("");
  const [channelCampaign, setChannelCampaign]   = useState<CampaignOption | null>(
    campaignId ? { id: campaignId, name: campaignName ?? "" } : null
  );
  const [channelResult, setChannelResult]       = useState<ChannelResult>(null);
  const [channelPending, startChannelTransition] = useTransition();

  // Copy-to-clipboard state
  const [copied, setCopied] = useState<string | null>(null);

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  // ── Single video submit ─────────────────────────────────────────────────────
  function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSingleResult(null);
    startSingleTransition(async () => {
      try {
        const res = await fetch("/api/ingest/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: videoUrl.trim(),
            brand_id: brandId,
            campaign_id: singleCampaign?.id ?? null,
          }),
        });
        const json = await res.json();
    if (res.ok) {
          setSingleResult({ status: "success", ...json });
          setVideoUrl("");
          // Only reset campaign if it wasn't locked from outside
          if (!campaignId) setSingleCampaign(null);
        } else {
          setSingleResult({ status: "error", ...json });
        }
      } catch (err) {
        setSingleResult({
          status: "error",
          error: "Network error — could not reach the server.",
          code: "NETWORK_ERROR",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  // ── Channel sync submit ─────────────────────────────────────────────────────
  function handleChannelSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChannelResult(null);
    startChannelTransition(async () => {
      try {
        const res = await fetch("/api/ingest/youtube-channel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel_url: channelUrl.trim(),
            brand_id: brandId,
            campaign_id: channelCampaign?.id ?? null,
            max_results: 15,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setChannelResult({ status: "success", ...json });
          setChannelUrl("");
          // Only reset campaign if it wasn't locked from outside
          if (!campaignId) setChannelCampaign(null);
        } else {
          setChannelResult({ status: "error", ...json });
        }
      } catch (err) {
        setChannelResult({
          status: "error",
          error: "Network error — could not reach the server.",
          code: "NETWORK_ERROR",
        });
      }
    });
  }

  const anyPending = singlePending || channelPending;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "22px",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            background: "rgba(255,68,68,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <PlayCircle size={18} color="#ff4444" />
        </div>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            YouTube Ingestion
          </h3>
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {brandName ? `Single video or bulk channel sync for ${brandName}` : "Ingest one video or the latest 5 from a channel"}
          </p>
        </div>
      </div>

      {/* ══ SINGLE VIDEO SECTION ═══════════════════════════════════════════════ */}
      <Divider label="Single Video" />

      <form
        id={`yt-form-${brandId}`}
        onSubmit={handleSingleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`yt-url-${brandId}`}>Video URL</FieldLabel>
          <InputRow
            id={`yt-url-${brandId}`}
            icon={<Link2 size={15} />}
            value={videoUrl}
            onChange={setVideoUrl}
            placeholder="https://youtu.be/… or youtube.com/watch?v=…"
            disabled={anyPending}
          />
        </div>

        {/* Campaign — hidden/locked when opened from campaign builder */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`yt-scampaign-${brandId}`}>
            Campaign {!campaignId && <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>}
          </FieldLabel>
          {campaignId ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ff4444" }}>🎯 Auto-tagged:</span>
              <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 600 }}>{campaignName ?? campaignId}</span>
            </div>
          ) : (
            <CampaignPicker
              brandId={brandId}
              instanceId={`yt-single-${brandId}`}
              disabled={anyPending}
              onChange={setSingleCampaign}
            />
          )}
        </div>

        <button
          id={`btn-yt-ingest-${brandId}`}
          type="submit"
          disabled={anyPending || !videoUrl.trim()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "8px", border: "none",
            background: anyPending || !videoUrl.trim() ? "var(--color-surface-2)" : "linear-gradient(135deg, #ff4444, #ff8800)",
            color: "#fff", fontSize: "13px", fontWeight: 600,
            cursor: anyPending || !videoUrl.trim() ? "not-allowed" : "pointer",
            opacity: anyPending || !videoUrl.trim() ? 0.6 : 1,
            transition: "opacity 200ms",
          }}
        >
          {singlePending ? (
            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Fetching…</>
          ) : (
            <><PlayCircle size={14} />Ingest Video</>
          )}
        </button>
      </form>

      {/* Single video success */}
      {singleResult?.status === "success" && (
        <div role="status" style={{
          display: "flex", flexDirection: "column", gap: "12px",
          padding: "14px", background: "rgba(255,68,68,0.06)",
          border: "1px solid rgba(255,68,68,0.18)", borderRadius: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#22d3a0", marginBottom: "2px" }}>
                Video ingested
              </p>
              <p style={{ fontSize: "12px", color: "var(--color-text-primary)", fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={singleResult.meta.title}>
                {singleResult.meta.title}
              </p>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                {singleResult.meta.channel} · {new Date(singleResult.meta.published_at).getFullYear()}
              </p>
            </div>
          </div>
          {singleResult.creative.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={singleResult.creative.thumbnail_url} alt={singleResult.meta.title}
              style={{ width: "100%", borderRadius: "8px", border: "1px solid var(--color-border)",
                objectFit: "cover", aspectRatio: "16/9" }} />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
            {[
              { icon: <Eye size={12} />, label: "Views",      value: fmt(singleResult.creative.view_count) },
              { icon: <ThumbsUp size={12} />, label: "Engmt", value: fmtRate(singleResult.creative.engagement_rate) },
              { icon: <BarChart2 size={12} />, label: "ID",   value: singleResult.creative.id.slice(0, 8) + "…" },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ background: "var(--color-surface-2)", borderRadius: "8px",
                padding: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px",
                  color: "var(--color-text-muted)", fontSize: "10px",
                  textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {icon}{label}
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          <a href={singleResult.creative.source_url} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "12px", color: "var(--color-text-secondary)", textDecoration: "none" }}>
            <ExternalLink size={11} />{singleResult.creative.source_url}
          </a>
        </div>
      )}
      {singleResult?.status === "error" && (
        <ErrorBanner code={singleResult.code} message={singleResult.error} detail={singleResult.detail} />
      )}

      {/* ══ CHANNEL SYNC SECTION ═══════════════════════════════════════════════ */}
      <Divider label="Bulk Channel Sync" />

      <form
        id={`yt-channel-form-${brandId}`}
        onSubmit={handleChannelSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`yt-ch-url-${brandId}`}>Channel URL</FieldLabel>
          <InputRow
            id={`yt-ch-url-${brandId}`}
            icon={<Tv2 size={15} />}
            value={channelUrl}
            onChange={setChannelUrl}
            placeholder="youtube.com/@NikeSportswear or /channel/UC…"
            disabled={anyPending}
          />
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Ingests the 5 most recent videos · 3 API quota units total
          </p>
        </div>

        {/* Campaign — hidden/locked when opened from campaign builder */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`yt-ch-campaign-${brandId}`}>
            Campaign {!campaignId && <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>}
          </FieldLabel>
          {campaignId ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#ff4444" }}>🎯 Auto-tagged:</span>
              <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 600 }}>{campaignName ?? campaignId}</span>
            </div>
          ) : (
            <CampaignPicker
              brandId={brandId}
              instanceId={`yt-channel-${brandId}`}
              disabled={anyPending}
              onChange={setChannelCampaign}
            />
          )}
        </div>

        <button
          id={`btn-yt-channel-${brandId}`}
          type="submit"
          disabled={anyPending || !channelUrl.trim()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "8px", border: "none",
            background: anyPending || !channelUrl.trim() ? "var(--color-surface-2)" : "linear-gradient(135deg, #7c3aed, #db2777)",
            color: "#fff", fontSize: "13px", fontWeight: 600,
            cursor: anyPending || !channelUrl.trim() ? "not-allowed" : "pointer",
            opacity: anyPending || !channelUrl.trim() ? 0.6 : 1,
            transition: "opacity 200ms",
          }}
        >
          {channelPending ? (
            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Syncing channel…</>
          ) : (
            <><RefreshCw size={14} />Sync Latest 5 Videos</>
          )}
        </button>
      </form>

      {/* Channel sync results */}
      {channelResult?.status === "success" && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Summary bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 14px",
            background: "rgba(124,58,237,0.08)",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: "10px", flexWrap: "wrap",
          }}>
            <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)", flex: 1 }}>
              {channelResult.summary.channel || "Channel"} synced
            </span>
            {[
              { label: "Saved",      value: channelResult.summary.inserted,   color: "#22d3a0" },
              { label: "Duplicates", value: channelResult.summary.duplicates, color: "#f59e0b" },
              { label: "Errors",     value: channelResult.summary.errors,     color: "#f43f5e" },
            ].map(({ label, value, color }) => (
              <span key={label} style={{
                fontSize: "12px", fontWeight: 700, color,
                background: `${color}18`, borderRadius: "6px",
                padding: "3px 10px",
              }}>
                {value} {label}
              </span>
            ))}
          </div>

          {/* Per-video result rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {channelResult.results.map((r, i) => (
              <div
                key={r.source_url}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 12px",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "8px",
                  animation: `fadeInUp 0.3s ease both`,
                  animationDelay: `${i * 60}ms`,
                }}
              >
                {/* Thumbnail */}
                {r.status === "inserted" && r.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbnail_url} alt={r.title}
                    style={{ width: 56, height: 32, objectFit: "cover", borderRadius: "4px", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 56, height: 32, background: "var(--color-border)",
                    borderRadius: "4px", flexShrink: 0, display: "flex", alignItems: "center",
                    justifyContent: "center" }}>
                    <PlayCircle size={14} color="var(--color-text-muted)" />
                  </div>
                )}

                {/* Title + stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={r.title}>
                    {r.title}
                  </p>
                  {r.status === "inserted" && (
                    <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                      {fmt(r.view_count)} views · {fmtRate(r.engagement_rate)} engagement
                    </p>
                  )}
                  {r.status === "error" && (
                    <p style={{ fontSize: "11px", color: "#f43f5e", marginTop: "2px" }}>{r.error}</p>
                  )}
                </div>

                {/* Status badge */}
                <span style={{
                  fontSize: "10px", fontWeight: 700, flexShrink: 0,
                  color: STATUS_COLOR[r.status],
                  background: `${STATUS_COLOR[r.status]}18`,
                  borderRadius: "5px", padding: "3px 8px",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {STATUS_LABEL[r.status]}
                </span>

                {/* Copy ID (inserted only) */}
                {r.status === "inserted" && r.creative_id && (
                  <button
                    onClick={() => copyId(r.creative_id!)}
                    title="Copy creative ID"
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "4px",
                      color: "var(--color-text-muted)", flexShrink: 0,
                    }}
                  >
                    {copied === r.creative_id ? <Check size={13} color="#22d3a0" /> : <Copy size={13} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {channelResult?.status === "error" && (
        <ErrorBanner code={channelResult.code} message={channelResult.error} />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
