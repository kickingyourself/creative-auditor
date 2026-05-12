"use client";

/**
 * components/PinterestIngestForm.tsx
 *
 * Ingest a single Pinterest pin by URL.
 * Uses the public Pinterest oEmbed endpoint (no API key required).
 */

import { useState, useTransition } from "react";
import {
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
import { CampaignPicker } from "@/components/CampaignPicker";
import type { CampaignOption } from "@/components/CampaignPicker";

// ── Pinterest "P" icon (not in lucide) ───────────────────────────────────────

function PinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PinterestIngestSuccess {
  status: "success";
  creative: { id: string; thumbnail_url: string | null; source_url: string };
  meta: { title: string | null; author: string | null; thumbnail_url: string | null; pin_url: string };
}
interface PinterestIngestError {
  status: "error";
  error: string;
  code: string;
  detail?: string;
}
type Result = PinterestIngestSuccess | PinterestIngestError | null;

// ── Shared sub-components (mirrors YouTubeIngestForm style) ──────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{
      fontSize: "12px", fontWeight: 600,
      color: "var(--color-text-secondary)",
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {children}
    </label>
  );
}

function InputRow({ id, icon, value, onChange, placeholder, disabled }: {
  id: string; icon: React.ReactNode; value: string;
  onChange: (v: string) => void; placeholder: string; disabled?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      background: "var(--color-surface-2)",
      border: "1px solid var(--color-border)",
      borderRadius: "8px", padding: "10px 14px",
    }}>
      <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{icon}</span>
      <input
        id={id} type="text" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        style={{
          border: "none", outline: "none", background: "transparent",
          color: "var(--color-text-primary)", fontSize: "13px", width: "100%",
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { brandId: string; brandName?: string; }

const PINTEREST_RED = "#e60023";

export function PinterestIngestForm({ brandId, brandName }: Props) {
  const [pinUrl, setPinUrl]                   = useState("");
  const [campaign, setCampaign]               = useState<CampaignOption | null>(null);
  const [result, setResult]                   = useState<Result>(null);
  const [pending, startTransition]            = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/ingest/pinterest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url:         pinUrl.trim(),
            brand_id:    brandId,
            campaign_id: campaign?.id ?? null,
          }),
        });
        const json = await res.json();
        setResult(res.ok
          ? { status: "success", ...json }
          : { status: "error",   ...json }
        );
        if (res.ok) { setPinUrl(""); setCampaign(null); }
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

  const disabled = pending || !pinUrl.trim();

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "14px", padding: "24px",
      display: "flex", flexDirection: "column", gap: "20px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "10px", flexShrink: 0,
          background: "rgba(230,0,35,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: PINTEREST_RED,
        }}>
          <PinIcon size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
            Pinterest Pin
          </h3>
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {brandName
              ? `Save a Pinterest pin for ${brandName}`
              : "Paste a Pinterest pin URL to save it as a creative"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form id={`pin-form-${brandId}`} onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`pin-url-${brandId}`}>Pin URL</FieldLabel>
          <InputRow
            id={`pin-url-${brandId}`}
            icon={<Link2 size={15} />}
            value={pinUrl}
            onChange={setPinUrl}
            placeholder="https://pinterest.com/pin/… or pin.it/…"
            disabled={pending}
          />
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Paste any public Pinterest pin URL · thumbnail fetched automatically
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`pin-campaign-${brandId}`}>
            Campaign <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
          </FieldLabel>
          <CampaignPicker
            brandId={brandId}
            instanceId={`pinterest-${brandId}`}
            disabled={pending}
            onChange={setCampaign}
          />
        </div>

        <button
          id={`btn-pin-ingest-${brandId}`}
          type="submit"
          disabled={disabled}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "8px", border: "none",
            background: disabled
              ? "var(--color-surface-2)"
              : `linear-gradient(135deg, ${PINTEREST_RED}, #ad081b)`,
            color: disabled ? "var(--color-text-muted)" : "#fff",
            fontSize: "13px", fontWeight: 600,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            transition: "opacity 200ms",
          }}
        >
          {pending
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving pin…</>
            : <><PinIcon size={14} /> Save Pin</>}
        </button>
      </form>

      {/* Success */}
      {result?.status === "success" && (
        <div role="status" style={{
          display: "flex", flexDirection: "column", gap: "12px",
          padding: "14px",
          background: "rgba(230,0,35,0.06)",
          border: "1px solid rgba(230,0,35,0.18)",
          borderRadius: "10px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#22d3a0", marginBottom: "2px" }}>
                Pin saved
              </p>
              {result.meta.title && (
                <p style={{
                  fontSize: "12px", fontWeight: 600,
                  color: "var(--color-text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={result.meta.title}>
                  {result.meta.title}
                </p>
              )}
              {result.meta.author && (
                <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                  by {result.meta.author}
                </p>
              )}
            </div>
          </div>

          {result.meta.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.meta.thumbnail_url}
              alt={result.meta.title ?? "Pinterest pin"}
              style={{
                width: "100%", borderRadius: "8px",
                border: "1px solid var(--color-border)",
                objectFit: "cover", aspectRatio: "1/1",
              }}
            />
          ) : (
            <div style={{
              width: "100%", aspectRatio: "1/1", borderRadius: "8px",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-text-muted)",
            }}>
              <ImageIcon size={28} />
            </div>
          )}

          <a
            href={result.meta.pin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "12px", color: "var(--color-text-secondary)", textDecoration: "none",
            }}
          >
            <ExternalLink size={11} />
            {result.meta.pin_url}
          </a>
        </div>
      )}

      {/* Error */}
      {result?.status === "error" && (
        <div role="alert" style={{
          display: "flex", gap: "10px", padding: "14px",
          background: "rgba(244,63,94,0.08)",
          border: "1px solid rgba(244,63,94,0.2)",
          borderRadius: "10px",
        }}>
          <AlertCircle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#f43f5e", marginBottom: "3px" }}>
              {result.code}
            </p>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{result.error}</p>
            {result.detail && (
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px", fontFamily: "monospace" }}>
                {result.detail}
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
