"use client";

import { useState, useTransition } from "react";
import {
  Link2, Loader2, CheckCircle2, AlertCircle, ExternalLink,
  Eye, BarChart2, RefreshCw, Copy, Check, Film, Image, LayoutGrid,
} from "lucide-react";
import { CampaignPicker } from "@/components/CampaignPicker";
import type { CampaignOption } from "@/components/CampaignPicker";

function FbIcon({ size = 14, color, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? "currentColor"} style={style} aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SingleSuccess {
  status: "success";
  creative: { id: string; thumbnail_url: string | null; view_count: number | null; engagement_rate: number | null; source_url: string };
  meta: { ad_id: string; creative_id: string; name: string; ad_format: string; effective_status: string | null; created_time: string | null; impressions: number | null; spend: string | null; reach: number | null };
}
interface SingleError { status: "error"; error: string; code: string; detail?: string }
type SingleResult = SingleSuccess | SingleError | null;

interface BulkAdResult {
  status: "inserted" | "duplicate" | "error";
  ad_id: string; name: string; thumbnail_url: string | null; ad_format: string;
  impressions?: number | null; creative_id?: string; error?: string;
}
interface BulkSuccess {
  status: "success";
  summary: { inserted: number; duplicates: number; errors: number; account_id: string; total_fetched: number };
  results: BulkAdResult[];
}
interface BulkError { status: "error"; error: string; code: string }
type BulkResult = BulkSuccess | BulkError | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function fmtRate(r: number | null | undefined) {
  if (r == null) return "—";
  return `${(r * 100).toFixed(2)}%`;
}

const FB_BLUE = "#1877f2";
const FB_BG = "rgba(24,119,242,0.10)";

const STATUS_COLOR = { inserted: "#22d3a0", duplicate: "#f59e0b", error: "#f43f5e" } as const;
const STATUS_LABEL = { inserted: "Saved", duplicate: "Exists", error: "Failed" } as const;

function AdFormatIcon({ f }: { f: string }) {
  if (f === "video") return <Film size={12} />;
  if (f === "carousel") return <LayoutGrid size={12} />;
  return <Image size={12} />;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function InputRow({ id, icon, value, onChange, placeholder, disabled }: {
  id: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px" }}>
      <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{icon}</span>
      <input id={id} type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} autoComplete="off"
        style={{ border: "none", outline: "none", background: "transparent", color: "var(--color-text-primary)", fontSize: 13, width: "100%", opacity: disabled ? 0.5 : 1 }} />
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{children}</label>;
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--color-text-muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />{label}<div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
    </div>
  );
}

function ErrorBanner({ code, message, detail }: { code: string; message: string; detail?: string }) {
  return (
    <div role="alert" style={{ display: "flex", gap: 10, padding: 14, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
      <AlertCircle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#f43f5e", marginBottom: 3 }}>{code}</p>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{message}</p>
        {detail && <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 4, fontFamily: "monospace" }}>{detail}</p>}
      </div>
    </div>
  );
}

function SubmitBtn({ id, disabled, pending, label, pendingLabel, color, shadow }: {
  id: string; disabled: boolean; pending: boolean; label: string; pendingLabel: string; color: string; shadow: string;
}) {
  return (
    <button id={id} type="submit" disabled={disabled}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", borderRadius: 8, border: "none",
        background: disabled ? "var(--color-surface-2)" : color, color: "#fff", fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, transition: "opacity 200ms",
        boxShadow: disabled ? "none" : shadow }}>
      {pending
        ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />{pendingLabel}</>
        : <><FbIcon size={14} />{label}</>}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { brandId: string; brandName?: string }

export function FacebookIngestForm({ brandId, brandName }: Props) {
  // Single ad state
  const [adId, setAdId] = useState("");
  const [singleCampaign, setSingleCampaign] = useState<CampaignOption | null>(null);
  const [singleResult, setSingleResult] = useState<SingleResult>(null);
  const [singlePending, startSingle] = useTransition();

  // Bulk account state
  const [accountId, setAccountId] = useState("");
  const [bulkCampaign, setBulkCampaign] = useState<CampaignOption | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResult>(null);
  const [bulkPending, startBulk] = useTransition();

  const [copied, setCopied] = useState<string | null>(null);
  const anyPending = singlePending || bulkPending;

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1500); });
  }

  function handleSingle(e: React.FormEvent) {
    e.preventDefault(); setSingleResult(null);
    startSingle(async () => {
      try {
        const res = await fetch("/api/ingest/facebook", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "single", ad_id: adId.trim(), brand_id: brandId, campaign_id: singleCampaign?.id ?? null }),
        });
        const json = await res.json();
        setSingleResult(res.ok ? { status: "success", ...json } : { status: "error", ...json });
        if (res.ok) { setAdId(""); setSingleCampaign(null); }
      } catch (err) {
        setSingleResult({ status: "error", error: "Network error", code: "NETWORK_ERROR", detail: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  function handleBulk(e: React.FormEvent) {
    e.preventDefault(); setBulkResult(null);
    startBulk(async () => {
      try {
        const res = await fetch("/api/ingest/facebook", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "account", ad_account_id: accountId.trim() || null, brand_id: brandId, campaign_id: bulkCampaign?.id ?? null, max_results: 10 }),
        });
        const json = await res.json();
        setBulkResult(res.ok ? { status: "success", ...json } : { status: "error", ...json });
        if (res.ok) { setAccountId(""); setBulkCampaign(null); }
      } catch (err) {
        setBulkResult({ status: "error", error: "Network error", code: "NETWORK_ERROR" });
      }
    });
  }

  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: FB_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FbIcon size={18} color={FB_BLUE} />
        </div>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>Facebook Ads Ingestion</h3>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
            {brandName ? `Fetch ad creatives via Marketing API for ${brandName}` : "Fetch ad creatives via Meta Marketing API"}
          </p>
        </div>
      </div>

      {/* Info callout */}
      <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: FB_BG, border: "1px solid rgba(24,119,242,0.20)", borderRadius: 10 }}>
        <FbIcon size={14} color={FB_BLUE} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Requires <strong style={{ color: "var(--color-text-primary)" }}>META_ACCESS_TOKEN</strong> with{" "}
          <code style={{ fontSize: 11, color: FB_BLUE }}>ads_read</code> scope. Token must have access to the target ad account.
        </p>
      </div>

      {/* ── Single Ad ── */}
      <Divider label="Single Ad by ID" />

      <form id={`fb-single-${brandId}`} onSubmit={handleSingle} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel htmlFor={`fb-adid-${brandId}`}>Ad ID</FieldLabel>
          <InputRow id={`fb-adid-${brandId}`} icon={<Link2 size={15} />} value={adId} onChange={setAdId}
            placeholder="23844567890123456" disabled={anyPending} />
          <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Numeric ad ID from Ads Manager (not creative ID)</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel htmlFor={`fb-scampaign-${brandId}`}>Campaign <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span></FieldLabel>
          <CampaignPicker brandId={brandId} instanceId={`fb-single-${brandId}`} disabled={anyPending} onChange={setSingleCampaign} />
        </div>
        <SubmitBtn id={`btn-fb-single-${brandId}`} disabled={anyPending || !adId.trim()} pending={singlePending}
          label="Ingest Ad" pendingLabel="Fetching…"
          color={`linear-gradient(135deg, ${FB_BLUE}, #0a5cc7)`} shadow="0 4px 12px rgba(24,119,242,0.30)" />
      </form>

      {singleResult?.status === "success" && (() => {
        const r = singleResult;
        return (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, background: FB_BG, border: "1px solid rgba(24,119,242,0.20)", borderRadius: 10, animation: "fadeInUp 0.25s ease both" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#22d3a0", marginBottom: 2 }}>Ad ingested</p>
                <p style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.meta.name}>{r.meta.name}</p>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><AdFormatIcon f={r.meta.ad_format} />{r.meta.ad_format}</span>
                  {r.meta.effective_status && <> · {r.meta.effective_status}</>}
                </p>
              </div>
            </div>
            {r.creative.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.creative.thumbnail_url} alt={r.meta.name} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--color-border)", objectFit: "cover", aspectRatio: "1.91/1", maxHeight: 200 }} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[
                { icon: <Eye size={12} />, label: "Reach", value: fmt(r.meta.reach ?? r.creative.view_count) },
                { icon: <BarChart2 size={12} />, label: "Impress.", value: fmt(r.meta.impressions) },
                { icon: <BarChart2 size={12} />, label: "Spend", value: r.meta.spend != null ? `$${parseFloat(r.meta.spend).toFixed(2)}` : "—" },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ background: "var(--color-surface-2)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{icon}{label}</div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <a href={r.creative.source_url} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--color-text-secondary)", textDecoration: "none" }}>
                <ExternalLink size={11} />Ads Library
              </a>
              {r.creative.engagement_rate != null && (
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>CTR: <strong style={{ color: "var(--color-text-primary)" }}>{fmtRate(r.creative.engagement_rate)}</strong></span>
              )}
            </div>
          </div>
        );
      })()}
      {singleResult?.status === "error" && <ErrorBanner code={singleResult.code} message={singleResult.error} detail={singleResult.detail} />}

      {/* ── Bulk Account ── */}
      <Divider label="Bulk Account Sync" />

      <form id={`fb-bulk-${brandId}`} onSubmit={handleBulk} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel htmlFor={`fb-accid-${brandId}`}>Ad Account ID <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(override)</span></FieldLabel>
          <InputRow id={`fb-accid-${brandId}`} icon={<FbIcon size={15} />} value={accountId} onChange={setAccountId}
            placeholder="act_123456789  or  123456789" disabled={anyPending} />
          <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Leave blank to use <code style={{ fontSize: 10 }}>META_AD_ACCOUNT_ID</code> env var · fetches 10 most recent ads</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel htmlFor={`fb-bcampaign-${brandId}`}>Campaign <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span></FieldLabel>
          <CampaignPicker brandId={brandId} instanceId={`fb-bulk-${brandId}`} disabled={anyPending} onChange={setBulkCampaign} />
        </div>
        <SubmitBtn id={`btn-fb-bulk-${brandId}`} disabled={anyPending} pending={bulkPending}
          label="Sync Latest 10 Ads" pendingLabel="Syncing account…"
          color="linear-gradient(135deg, #7c3aed, #1877f2)" shadow="0 4px 12px rgba(124,58,237,0.30)" />
      </form>

      {bulkResult?.status === "success" && (() => {
        const r = bulkResult;
        return (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: FB_BG, border: "1px solid rgba(24,119,242,0.20)", borderRadius: 10, flexWrap: "wrap" }}>
              <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", flex: 1 }}>{r.summary.account_id} synced</span>
              {([["Saved", r.summary.inserted, "#22d3a0"], ["Dupes", r.summary.duplicates, "#f59e0b"], ["Errors", r.summary.errors, "#f43f5e"]] as const).map(([label, value, color]) => (
                <span key={label} style={{ fontSize: 12, fontWeight: 700, color, background: `${color}18`, borderRadius: 6, padding: "3px 10px" }}>{value} {label}</span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {r.results.map((ad, i) => (
                <div key={ad.ad_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, animation: "fadeInUp 0.3s ease both", animationDelay: `${i * 50}ms` }}>
                  {ad.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.thumbnail_url} alt={ad.name} style={{ width: 56, height: 32, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 56, height: 32, background: "var(--color-border)", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FbIcon size={14} color="var(--color-text-muted)" />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ad.name}>{ad.name}</p>
                    <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <AdFormatIcon f={ad.ad_format} />{ad.ad_format}
                      {ad.status === "inserted" && ad.impressions != null && <> · {fmt(ad.impressions)} impr.</>}
                      {ad.status === "error" && <span style={{ color: "#f43f5e" }}> · {ad.error}</span>}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: STATUS_COLOR[ad.status], background: `${STATUS_COLOR[ad.status]}18`, borderRadius: 5, padding: "3px 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {STATUS_LABEL[ad.status]}
                  </span>
                  {ad.status === "inserted" && ad.creative_id && (
                    <button onClick={() => copyId(ad.creative_id!)} title="Copy creative ID"
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--color-text-muted)", flexShrink: 0 }}>
                      {copied === ad.creative_id ? <Check size={13} color="#22d3a0" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {bulkResult?.status === "error" && <ErrorBanner code={bulkResult.code} message={bulkResult.error} />}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
