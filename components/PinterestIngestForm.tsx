"use client";

/**
 * components/PinterestIngestForm.tsx
 *
 * Two-section form:
 *   1. Single Pin  — paste a pin URL, save via oEmbed (existing behaviour)
 *   2. Bulk Profile Sync — paste a brand profile URL, ingest first 15 pins
 */

import { useState, useTransition } from "react";
import {
  Link2,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
} from "lucide-react";
import { CampaignPicker } from "@/components/CampaignPicker";
import type { CampaignOption } from "@/components/CampaignPicker";

// ── Pinterest "P" icon (not in lucide) ────────────────────────────────────────

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
type SingleResult = PinterestIngestSuccess | PinterestIngestError | null;

// Bulk profile result types (mirror youtube-channel)
interface ProfilePinResult {
  status: "inserted" | "duplicate" | "error";
  source_url: string;
  title: string | null;
  thumbnail_url?: string | null;
  creative_id?: string;
  error?: string;
}
interface ProfileIngestSuccess {
  status: "success";
  summary: { inserted: number; duplicates: number; errors: number; profile: string; max_results: number };
  results: ProfilePinResult[];
}
interface ProfileIngestError {
  status: "error";
  error: string;
  code: string;
}
type ProfileResult = ProfileIngestSuccess | ProfileIngestError | null;

// ── Shared sub-components ─────────────────────────────────────────────────────

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

function Divider({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      color: "var(--color-text-muted)", fontSize: "11px",
      fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
      {label}
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
    </div>
  );
}

function ErrorBanner({ code, message, detail }: { code: string; message: string; detail?: string }) {
  return (
    <div role="alert" style={{
      display: "flex", gap: "10px", padding: "14px",
      background: "rgba(244,63,94,0.08)",
      border: "1px solid rgba(244,63,94,0.2)",
      borderRadius: "10px",
    }}>
      <AlertCircle size={16} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#f43f5e", marginBottom: "3px" }}>{code}</p>
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

const STATUS_COLOR: Record<ProfilePinResult["status"], string> = {
  inserted:  "#22d3a0",
  duplicate: "#f59e0b",
  error:     "#f43f5e",
};
const STATUS_LABEL: Record<ProfilePinResult["status"], string> = {
  inserted:  "Saved",
  duplicate: "Already exists",
  error:     "Failed",
};

// ── Main component ────────────────────────────────────────────────────────────

interface Props { brandId: string; brandName?: string; }

const PINTEREST_RED = "#e60023";

export function PinterestIngestForm({ brandId, brandName }: Props) {
  // Single pin state
  const [pinUrl, setPinUrl]               = useState("");
  const [singleCampaign, setSingleCampaign] = useState<CampaignOption | null>(null);
  const [singleResult, setSingleResult]   = useState<SingleResult>(null);
  const [singlePending, startSingleTransition] = useTransition();

  // Bulk profile state
  const [profileUrl, setProfileUrl]           = useState("");
  const [profileCampaign, setProfileCampaign] = useState<CampaignOption | null>(null);
  const [profileResult, setProfileResult]     = useState<ProfileResult>(null);
  const [profilePending, startProfileTransition] = useTransition();

  const anyPending = singlePending || profilePending;

  // ── Single pin submit ───────────────────────────────────────────────────────
  function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSingleResult(null);
    startSingleTransition(async () => {
      try {
        const res = await fetch("/api/ingest/pinterest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url:         pinUrl.trim(),
            brand_id:    brandId,
            campaign_id: singleCampaign?.id ?? null,
          }),
        });
        const json = await res.json();
        setSingleResult(res.ok
          ? { status: "success", ...json }
          : { status: "error",   ...json }
        );
        if (res.ok) { setPinUrl(""); setSingleCampaign(null); }
      } catch (err) {
        setSingleResult({
          status: "error", code: "NETWORK_ERROR",
          error: "Network error — could not reach the server.",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  // ── Bulk profile submit ─────────────────────────────────────────────────────
  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileResult(null);
    startProfileTransition(async () => {
      try {
        const res = await fetch("/api/ingest/pinterest-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile_url: profileUrl.trim(),
            brand_id:    brandId,
            campaign_id: profileCampaign?.id ?? null,
            max_results: 15,
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setProfileResult({ status: "success", ...json });
          setProfileUrl("");
          setProfileCampaign(null);
        } else {
          setProfileResult({ status: "error", ...json });
        }
      } catch (err) {
        setProfileResult({
          status: "error", code: "NETWORK_ERROR",
          error: "Network error — could not reach the server.",
        });
      }
    });
  }

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "14px", padding: "24px",
      display: "flex", flexDirection: "column", gap: "22px",
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
            Pinterest Ingestion
          </h3>
          <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {brandName ? `Single pin or bulk profile sync for ${brandName}` : "Ingest one pin or the latest 15 from a profile"}
          </p>
        </div>
      </div>

      {/* ══ SINGLE PIN SECTION ═══════════════════════════════════════════════ */}
      <Divider label="Single Pin" />

      <form id={`pin-form-${brandId}`} onSubmit={handleSingleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`pin-url-${brandId}`}>Pin URL</FieldLabel>
          <InputRow
            id={`pin-url-${brandId}`}
            icon={<Link2 size={15} />}
            value={pinUrl}
            onChange={setPinUrl}
            placeholder="https://pinterest.com/pin/… or pin.it/…"
            disabled={anyPending}
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
            instanceId={`pinterest-single-${brandId}`}
            disabled={anyPending}
            onChange={setSingleCampaign}
          />
        </div>

        <button
          id={`btn-pin-ingest-${brandId}`}
          type="submit"
          disabled={anyPending || !pinUrl.trim()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "8px", border: "none",
            background: anyPending || !pinUrl.trim()
              ? "var(--color-surface-2)"
              : `linear-gradient(135deg, ${PINTEREST_RED}, #ad081b)`,
            color: anyPending || !pinUrl.trim() ? "var(--color-text-muted)" : "#fff",
            fontSize: "13px", fontWeight: 600,
            cursor: anyPending || !pinUrl.trim() ? "not-allowed" : "pointer",
            opacity: anyPending || !pinUrl.trim() ? 0.6 : 1,
            transition: "opacity 200ms",
          }}
        >
          {singlePending
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Saving pin…</>
            : <><PinIcon size={14} /> Save Pin</>}
        </button>
      </form>

      {/* Single pin success */}
      {singleResult?.status === "success" && (
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
              {singleResult.meta.title && (
                <p style={{
                  fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={singleResult.meta.title}>
                  {singleResult.meta.title}
                </p>
              )}
              {singleResult.meta.author && (
                <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
                  by {singleResult.meta.author}
                </p>
              )}
            </div>
          </div>

          {singleResult.meta.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={singleResult.meta.thumbnail_url}
              alt={singleResult.meta.title ?? "Pinterest pin"}
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
            href={singleResult.meta.pin_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              fontSize: "12px", color: "var(--color-text-secondary)", textDecoration: "none",
            }}
          >
            <ExternalLink size={11} />
            {singleResult.meta.pin_url}
          </a>
        </div>
      )}
      {singleResult?.status === "error" && (
        <ErrorBanner code={singleResult.code} message={singleResult.error} detail={singleResult.detail} />
      )}

      {/* ══ BULK PROFILE SYNC SECTION ════════════════════════════════════════ */}
      <Divider label="Bulk Profile Sync" />

      <form id={`pin-profile-form-${brandId}`} onSubmit={handleProfileSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`pin-profile-${brandId}`}>Profile URL</FieldLabel>
          <InputRow
            id={`pin-profile-${brandId}`}
            icon={<Globe size={15} />}
            value={profileUrl}
            onChange={setProfileUrl}
            placeholder="pinterest.com/nike or pinterest.com/adidas"
            disabled={anyPending}
          />
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>
            Ingests the first 15 pins from the profile · duplicates skipped automatically
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <FieldLabel htmlFor={`pin-profile-campaign-${brandId}`}>
            Campaign <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span>
          </FieldLabel>
          <CampaignPicker
            brandId={brandId}
            instanceId={`pinterest-profile-${brandId}`}
            disabled={anyPending}
            onChange={setProfileCampaign}
          />
        </div>

        <button
          id={`btn-pin-profile-${brandId}`}
          type="submit"
          disabled={anyPending || !profileUrl.trim()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "8px", border: "none",
            background: anyPending || !profileUrl.trim()
              ? "var(--color-surface-2)"
              : "linear-gradient(135deg, #7c3aed, #e60023)",
            color: anyPending || !profileUrl.trim() ? "var(--color-text-muted)" : "#fff",
            fontSize: "13px", fontWeight: 600,
            cursor: anyPending || !profileUrl.trim() ? "not-allowed" : "pointer",
            opacity: anyPending || !profileUrl.trim() ? 0.6 : 1,
            transition: "opacity 200ms",
          }}
        >
          {profilePending
            ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Syncing profile…</>
            : <><RefreshCw size={14} /> Sync First 15 Pins</>}
        </button>
      </form>

      {/* Bulk profile success */}
      {profileResult?.status === "success" && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Summary bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 14px",
            background: "rgba(230,0,35,0.08)",
            border: "1px solid rgba(230,0,35,0.2)",
            borderRadius: "10px", flexWrap: "wrap",
          }}>
            <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)", flex: 1 }}>
              @{profileResult.summary.profile} synced
            </span>
            {[
              { label: "Saved",      value: profileResult.summary.inserted,   color: "#22d3a0" },
              { label: "Duplicates", value: profileResult.summary.duplicates, color: "#f59e0b" },
              { label: "Errors",     value: profileResult.summary.errors,     color: "#f43f5e" },
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

          {/* Per-pin result rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {profileResult.results.map((r, i) => (
              <div key={r.source_url} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 12px",
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                animation: "fadeInUp 0.3s ease both",
                animationDelay: `${i * 40}ms`,
              }}>
                {/* Thumbnail */}
                {r.status === "inserted" && r.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbnail_url} alt={r.title ?? ""}
                    style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, background: "var(--color-border)",
                    borderRadius: "6px", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <PinIcon size={14} />
                  </div>
                )}

                {/* Title + URL */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }} title={r.title ?? r.source_url}>
                    {r.title ?? r.source_url.replace("https://www.pinterest.com/pin/", "Pin ")}
                  </p>
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
              </div>
            ))}
          </div>
        </div>
      )}
      {profileResult?.status === "error" && (
        <ErrorBanner code={profileResult.code} message={profileResult.error} />
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
