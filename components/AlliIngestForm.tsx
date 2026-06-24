"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Eye,
  FileImage,
  Film,
  File,
} from "lucide-react";
import { CampaignPicker } from "@/components/CampaignPicker";
import type { CampaignOption } from "@/components/CampaignPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlliPrefix = "digital_asset_manager" | "brand_media";

interface AssetResult {
  id: string;
  status: "created" | "skipped" | "error";
  reason?: string;
}

interface IngestSuccess {
  job_id: string;
  prefix: string;
  tool_used: string;
  asset_count: number;
  created: number;
  skipped: number;
  errors: number;
  results: AssetResult[];
}

interface DryRunSuccess {
  job_id: string;
  dry_run: true;
  tool_used: string;
  asset_count: number;
  preview: unknown[];
}

interface IngestError {
  error: string;
  code?: string;
  job_id?: string;
}

type IngestResult = IngestSuccess | DryRunSuccess | IngestError | null;

interface AlliConnectionStatus {
  connected: boolean;
  expires_at?: string;
  needs_refresh?: boolean;
  has_refresh_token?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mimeIcon(mime: string) {
  if (mime.startsWith("video/")) return <Film size={12} />;
  if (mime.startsWith("image/")) return <FileImage size={12} />;
  return <File size={12} />;
}

function isIngestSuccess(r: IngestResult): r is IngestSuccess {
  return !!r && "created" in r && !("dry_run" in r);
}
function isDryRun(r: IngestResult): r is DryRunSuccess {
  return !!r && "dry_run" in r && (r as DryRunSuccess).dry_run === true;
}
function isError(r: IngestResult): r is IngestError {
  return !!r && "error" in r;
}

// ─── Connection status badge ──────────────────────────────────────────────────

function AlliStatusBadge({ status }: { status: AlliConnectionStatus | null }) {
  if (!status) {
    return (
      <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
        Checking connection…
      </span>
    );
  }
  if (!status.connected) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 600, color: "#f43f5e",
        background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
        padding: "2px 8px", borderRadius: 20,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f43f5e", display: "inline-block" }} />
        Not connected
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, color: "#22d3a0",
      background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.2)",
      padding: "2px 8px", borderRadius: 20,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: "#22d3a0",
        boxShadow: "0 0 5px #22d3a0", display: "inline-block",
      }} />
      Connected
    </span>
  );
}

// ─── Result summary ───────────────────────────────────────────────────────────

function ResultSummary({ result }: { result: IngestResult }) {
  if (!result) return null;

  if (isError(result)) {
    const isNotConnected = result.code === "ALLI_NOT_CONNECTED";
    return (
      <div style={{
        display: "flex", gap: 10, alignItems: "flex-start",
        padding: "12px 14px", borderRadius: 10,
        background: "rgba(244,63,94,0.07)", border: "1px solid rgba(244,63,94,0.2)",
      }}>
        <AlertCircle size={14} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#f43f5e", marginBottom: 2 }}>
            {isNotConnected ? "Alli not connected" : "Ingest failed"}
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {isNotConnected
              ? <>Go to <a href="/settings" style={{ color: "#4f6ef7" }}>Settings</a> to connect your Alli account.</>
              : result.error}
          </p>
        </div>
      </div>
    );
  }

  if (isDryRun(result)) {
    return (
      <div style={{
        padding: "12px 14px", borderRadius: 10,
        background: "rgba(79,110,247,0.07)", border: "1px solid rgba(79,110,247,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Eye size={13} color="#4f6ef7" />
          <p style={{ fontSize: 13, fontWeight: 600, color: "#4f6ef7" }}>
            Dry run — {result.asset_count} asset{result.asset_count !== 1 ? "s" : ""} found
          </p>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
          Tool used: <code style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>{result.tool_used}</code>
        </p>
        {result.preview.length > 0 && (
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer" }}>
              Preview first {result.preview.length} record{result.preview.length !== 1 ? "s" : ""}
            </summary>
            <pre style={{
              marginTop: 8, fontSize: 10, lineHeight: 1.5,
              color: "var(--color-text-secondary)",
              background: "rgba(0,0,0,0.2)", borderRadius: 6,
              padding: "8px 10px", overflowX: "auto", maxHeight: 200,
            }}>
              {JSON.stringify(result.preview, null, 2)}
            </pre>
          </details>
        )}
      </div>
    );
  }

  if (isIngestSuccess(result)) {
    const hasErrors = result.errors > 0;
    return (
      <div style={{
        padding: "12px 14px", borderRadius: 10,
        background: hasErrors ? "rgba(251,191,36,0.07)" : "rgba(34,211,160,0.07)",
        border: `1px solid ${hasErrors ? "rgba(251,191,36,0.2)" : "rgba(34,211,160,0.2)"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <CheckCircle2 size={13} color={hasErrors ? "#fbbf24" : "#22d3a0"} />
          <p style={{ fontSize: 13, fontWeight: 600, color: hasErrors ? "#fbbf24" : "#22d3a0" }}>
            Ingest complete
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Created", value: result.created, color: "#22d3a0" },
            { label: "Skipped", value: result.skipped, color: "var(--color-text-muted)" },
            { label: "Errors",  value: result.errors,  color: result.errors > 0 ? "#f43f5e" : "var(--color-text-muted)" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>
        {result.errors > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer" }}>
              Show errors
            </summary>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {result.results
                .filter(r => r.status === "error")
                .map(r => (
                  <p key={r.id} style={{ fontSize: 11, color: "#f43f5e" }}>
                    {r.id}: {r.reason}
                  </p>
                ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AlliIngestFormProps {
  brandId: string;
  brandName?: string;
}

export function AlliIngestForm({ brandId, brandName }: AlliIngestFormProps) {
  const [prefix, setPrefix]         = useState<AlliPrefix>("digital_asset_manager");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [limit, setLimit]           = useState(50);
  const [dryRun, setDryRun]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<IngestResult>(null);
  const [alliStatus, setAlliStatus] = useState<AlliConnectionStatus | null>(null);

  // Check Alli connection on mount
  useEffect(() => {
    fetch("/api/auth/alli/status")
      .then(r => r.json())
      .then(setAlliStatus)
      .catch(() => setAlliStatus({ connected: false }));
  }, []);

  async function handleIngest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ingest/pmg-alli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          brand_id:    brandId,
          campaign_id: campaignId ?? undefined,
          limit,
          dry_run:     dryRun,
        }),
      });
      const data = await res.json();
      setResult(data as IngestResult);
    } catch {
      setResult({ error: "Network error — check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }

  const notConnected = alliStatus !== null && !alliStatus.connected;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Connection status row */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 10,
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={13} color="#4f6ef7" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
            PMG Alli
          </span>
          <AlliStatusBadge status={alliStatus} />
        </div>
        {notConnected ? (
          <a
            href="/settings"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600, color: "#4f6ef7",
              textDecoration: "none",
            }}
          >
            Connect <ExternalLink size={10} />
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAlliStatus(null);
              fetch("/api/auth/alli/status")
                .then(r => r.json())
                .then(setAlliStatus)
                .catch(() => setAlliStatus({ connected: false }));
            }}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "var(--color-text-muted)",
            }}
          >
            <RefreshCw size={10} /> Refresh
          </button>
        )}
      </div>

      {/* Source picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
          Alli Source
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {(["digital_asset_manager", "brand_media"] as AlliPrefix[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setPrefix(p); setResult(null); }}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid",
                fontSize: 12, fontWeight: prefix === p ? 700 : 500,
                cursor: "pointer", transition: "all 150ms",
                borderColor: prefix === p ? "#4f6ef7" : "var(--color-border)",
                background:  prefix === p ? "rgba(79,110,247,0.1)" : "var(--color-surface)",
                color:       prefix === p ? "#4f6ef7" : "var(--color-text-secondary)",
              }}
            >
              {p === "digital_asset_manager" ? "DAM" : "Brand Media"}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          {prefix === "digital_asset_manager"
            ? "Digital Asset Manager — primary ad file store."
            : "Brand Media — brand-level media library."}
        </p>
      </div>

      {/* Campaign picker */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
          Campaign <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(optional)</span>
        </label>
        <CampaignPicker
          brandId={brandId}
          instanceId="alli-ingest"
          onChange={(opt: CampaignOption | null) => setCampaignId(opt?.id ?? null)}
        />
      </div>

      {/* Limit + dry run row */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
            Asset limit
          </label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={e => setLimit(Math.max(1, Math.min(200, Number(e.target.value))))}
            style={{
              padding: "8px 10px", borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
              color: "var(--color-text-primary)",
              fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
            }}
          />
        </div>

        <label style={{
          display: "flex", alignItems: "center", gap: 7,
          fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)",
          cursor: "pointer", paddingBottom: 8,
        }}>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={e => setDryRun(e.target.checked)}
            style={{ accentColor: "#4f6ef7", width: 14, height: 14 }}
          />
          Dry run
        </label>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleIngest}
        disabled={loading || notConnected}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 20px", borderRadius: 9, border: "none",
          background: notConnected
            ? "var(--color-surface-2)"
            : dryRun
              ? "linear-gradient(135deg, #4f6ef7, #8b5cf6)"
              : "linear-gradient(135deg, #4f6ef7, #8b5cf6)",
          color: notConnected ? "var(--color-text-muted)" : "#fff",
          fontSize: 13, fontWeight: 600,
          cursor: loading || notConnected ? "not-allowed" : "pointer",
          transition: "all 200ms",
          boxShadow: notConnected ? "none" : "0 4px 12px rgba(79,110,247,0.25)",
          alignSelf: "flex-start",
        }}
      >
        {loading
          ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Syncing…</>
          : dryRun
            ? <><Eye size={13} /> Preview assets</>
            : <><Zap size={13} /> Sync from Alli</>
        }
      </button>

      {/* Result */}
      <ResultSummary result={result} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
