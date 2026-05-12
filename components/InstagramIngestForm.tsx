"use client";

import { useState, useTransition } from "react";
import {
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Heart,
  MessageCircle,
  Eye,
  Film,
  Image,
  LayoutGrid,
  Info,
} from "lucide-react";
import { CampaignPicker } from "@/components/CampaignPicker";
import type { CampaignOption } from "@/components/CampaignPicker";

// Instagram brand icon (not in this version of lucide-react)
function IgIcon({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color ?? "currentColor"} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type IGMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";

interface InstagramIngestSuccess {
  status: "success";
  creative: {
    id: string;
    thumbnail_url: string | null;
    view_count: number | null;
    engagement_rate: number | null;
    source_url: string;
  };
  meta: {
    media_id: string;
    shortcode: string;
    caption_preview: string | null;
    media_type: IGMediaType;
    timestamp: string;
    like_count: number;
    comments_count: number;
  };
}

interface InstagramIngestError {
  status: "error";
  error: string;
  code: string;
  detail?: string;
}

type IngestResult = InstagramIngestSuccess | InstagramIngestError | null;

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

function mediaTypeLabel(t: IGMediaType): string {
  if (t === "CAROUSEL_ALBUM") return "Carousel";
  if (t === "REELS") return "Reel";
  if (t === "VIDEO") return "Video";
  return "Photo";
}

function MediaTypeIcon({ type }: { type: IGMediaType }) {
  if (type === "VIDEO" || type === "REELS") return <Film size={12} />;
  if (type === "CAROUSEL_ALBUM") return <LayoutGrid size={12} />;
  return <Image size={12} />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

interface InstagramIngestFormProps {
  brandId: string;
  brandName?: string;
}

// Instagram gradient palette
const IG_GRADIENT = "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)";
const IG_COLOR = "#e1306c";
const IG_BG = "rgba(225,48,108,0.09)";

export function InstagramIngestForm({ brandId, brandName }: InstagramIngestFormProps) {
  const [postUrl, setPostUrl] = useState("");
  const [campaign, setCampaign] = useState<CampaignOption | null>(null);
  const [igUserId, setIgUserId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<IngestResult>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ingest/instagram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: postUrl.trim(),
            brand_id: brandId,
            campaign_id: campaign?.id ?? null,
            ig_user_id: igUserId.trim() || null,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setResult({ status: "success", ...json });
          setPostUrl("");
          setCampaign(null);
        } else {
          setResult({ status: "error", ...json });
        }
      } catch (err) {
        setResult({
          status: "error",
          error: "Network error — could not reach the server.",
          code: "NETWORK_ERROR",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  const disabled = pending;

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            background: IG_BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <IgIcon size={18} color={IG_COLOR} />
        </div>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            Instagram Ingestion
          </h3>
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {brandName
              ? `Ingest an Instagram post or Reel for ${brandName}`
              : "Ingest an Instagram post, Reel, or Carousel"}
          </p>
        </div>
      </div>

      {/* Info callout */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "12px 14px",
          background: IG_BG,
          border: `1px solid rgba(225,48,108,0.20)`,
          borderRadius: "10px",
        }}
      >
        <Info size={14} color={IG_COLOR} style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
          Requires a connected{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>Instagram Business Account</strong>{" "}
          via Meta Business Suite. Only posts owned by your authenticated account can be fetched.
        </p>
      </div>

      {/* Form */}
      <form
        id={`ig-form-${brandId}`}
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        {/* Post URL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`ig-url-${brandId}`}>Post URL</FieldLabel>
          <InputRow
            id={`ig-url-${brandId}`}
            icon={<Link2 size={15} />}
            value={postUrl}
            onChange={setPostUrl}
            placeholder="https://www.instagram.com/p/ABC123xyz/"
            disabled={disabled}
          />
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Supports /p/, /reel/, and /tv/ post URLs
          </p>
        </div>

        {/* Campaign */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`ig-campaign-${brandId}`}>
            Campaign{" "}
            <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
          </FieldLabel>
          <CampaignPicker
            brandId={brandId}
            instanceId={`ig-${brandId}`}
            disabled={disabled}
            onChange={setCampaign}
          />
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0",
            fontSize: "12px",
            color: "var(--color-text-muted)",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {showAdvanced ? "▾" : "▸"} Advanced options
        </button>

        {/* Advanced: IG User ID override */}
        {showAdvanced && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "12px",
              background: "var(--color-surface-2)",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              animation: "fadeInUp 0.2s ease both",
            }}
          >
            <FieldLabel htmlFor={`ig-userid-${brandId}`}>
              IG Business Account ID{" "}
              <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(override)</span>
            </FieldLabel>
            <input
              id={`ig-userid-${brandId}`}
              type="text"
              value={igUserId}
              onChange={(e) => setIgUserId(e.target.value)}
              placeholder="Overrides INSTAGRAM_BUSINESS_ACCOUNT_ID env var"
              disabled={disabled}
              autoComplete="off"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "var(--color-text-primary)",
                fontSize: "13px",
                outline: "none",
                opacity: disabled ? 0.5 : 1,
              }}
            />
            <p style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
              Numeric Instagram Business Account ID. Find it in Meta Business Suite → Settings → Business Info.
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          id={`btn-ig-ingest-${brandId}`}
          type="submit"
          disabled={disabled || !postUrl.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background:
              disabled || !postUrl.trim() ? "var(--color-surface-2)" : IG_GRADIENT,
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: disabled || !postUrl.trim() ? "not-allowed" : "pointer",
            opacity: disabled || !postUrl.trim() ? 0.6 : 1,
            transition: "opacity 200ms, transform 150ms",
            boxShadow:
              disabled || !postUrl.trim()
                ? "none"
                : "0 4px 14px rgba(225,48,108,0.35)",
          }}
        >
          {pending ? (
            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Fetching…</>
          ) : (
            <><IgIcon size={14} />Ingest Post</>
          )}
        </button>
      </form>

      {/* Success result */}
      {result?.status === "success" && (
        <div
          role="status"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "14px",
            background: IG_BG,
            border: `1px solid rgba(225,48,108,0.20)`,
            borderRadius: "10px",
            animation: "fadeInUp 0.25s ease both",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#22d3a0", marginBottom: "2px" }}>
                Post ingested
              </p>
              {result.meta.caption_preview && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-primary)",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={result.meta.caption_preview}
                >
                  {result.meta.caption_preview}
                </p>
              )}
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                {mediaTypeLabel(result.meta.media_type)} ·{" "}
                {new Date(result.meta.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Thumbnail — square crop for IG aesthetic */}
          {result.creative.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.creative.thumbnail_url}
              alt={result.meta.caption_preview ?? "Instagram post"}
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                objectFit: "cover",
                aspectRatio: "1/1",
                maxHeight: 220,
              }}
            />
          )}

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {[
              { icon: <Eye size={12} />,         label: "Reach",    value: fmt(result.creative.view_count) },
              { icon: <Heart size={12} />,        label: "Likes",    value: fmt(result.meta.like_count) },
              { icon: <MessageCircle size={12} />,label: "Comments", value: fmt(result.meta.comments_count) },
            ].map(({ icon, label, value }) => (
              <div
                key={label}
                style={{
                  background: "var(--color-surface-2)",
                  borderRadius: "8px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "var(--color-text-muted)",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {icon}{label}
                </div>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)" }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Media type badge + engagement rate */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                color: IG_COLOR,
                background: IG_BG,
                padding: "3px 10px",
                borderRadius: "6px",
                fontWeight: 600,
              }}
            >
              <MediaTypeIcon type={result.meta.media_type} />
              {mediaTypeLabel(result.meta.media_type)}
            </span>
            {result.creative.engagement_rate != null && (
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
                Engagement:{" "}
                <strong style={{ color: "var(--color-text-primary)" }}>
                  {fmtRate(result.creative.engagement_rate)}
                </strong>
              </span>
            )}
          </div>

          <a
            href={result.creative.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "12px",
              color: "var(--color-text-secondary)",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={11} />
            {result.creative.source_url}
          </a>
        </div>
      )}

      {result?.status === "error" && (
        <ErrorBanner code={result.code} message={result.error} detail={result.detail} />
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
