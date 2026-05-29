"use client";

/**
 * app/settings/page.tsx
 *
 * Settings — API Connections.
 * Alli connection supports two auth methods:
 *   1. OAuth 2.1 + PKCE  (requires redirect URI registered with Alli)
 *   2. Manual Bearer token (paste from Alli DevTools — works immediately)
 */

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plug,
  Unplug,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Clock,
  ShieldCheck,
  Zap,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AlliStatus {
  connected: boolean;
  expires_at?: string;
  needs_refresh?: boolean;
  has_refresh_token?: boolean;
  scope?: string;
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AlliStatus | null }) {
  if (status === null) {
    return <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Checking…</span>;
  }
  if (!status.connected) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 700, color: "#f43f5e",
        background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)",
        padding: "3px 9px", borderRadius: 20,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f43f5e", display: "inline-block" }} />
        Disconnected
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 700, color: "#22d3a0",
      background: "rgba(34,211,160,0.1)", border: "1px solid rgba(34,211,160,0.25)",
      padding: "3px 9px", borderRadius: 20,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "#22d3a0", boxShadow: "0 0 6px #22d3a0",
        animation: "pulse 2s ease-in-out infinite", display: "inline-block",
      }} />
      Connected
    </span>
  );
}

// ── Manual token form ─────────────────────────────────────────────────────────

function ManualTokenForm({ onSuccess }: { onSuccess: () => void }) {
  const [token, setToken]       = useState("");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSave() {
    if (!token.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/alli/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ access_token: token.trim(), expires_in: 3600 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save token.");
        return;
      }
      setToken("");
      onSuccess();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* How-to callout */}
      <div style={{
        padding: "12px 14px", borderRadius: 10,
        background: "rgba(79,110,247,0.07)",
        border: "1px solid rgba(79,110,247,0.2)",
      }}>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--color-text-primary)" }}>How to get your token:</strong>
          {" "}Open <a href="https://app.alliplatform.com" target="_blank" rel="noreferrer" style={{ color: "#4f6ef7" }}>app.alliplatform.com</a>,
          open DevTools → Network tab, find any <code style={{ fontSize: 11, background: "rgba(255,255,255,0.07)", padding: "1px 4px", borderRadius: 3 }}>api.*</code> request,
          and copy the <code style={{ fontSize: 11, background: "rgba(255,255,255,0.07)", padding: "1px 4px", borderRadius: 3 }}>Authorization: Bearer …</code> header value.
        </p>
      </div>

      {/* Token input */}
      <div style={{ position: "relative" }}>
        <input
          type={showToken ? "text" : "password"}
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Paste Bearer token here…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "10px 42px 10px 12px",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 9, fontSize: 13,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-geist-mono), monospace",
            outline: "none",
          }}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
        />
        <button
          type="button"
          onClick={() => setShowToken(v => !v)}
          style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--color-text-muted)", display: "flex", alignItems: "center",
          }}
        >
          {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
          <AlertCircle size={13} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#f43f5e" }}>{error}</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || !token.trim()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "9px 18px", borderRadius: 9, border: "none",
          background: token.trim() ? "linear-gradient(135deg, #4f6ef7, #8b5cf6)" : "var(--color-surface-2)",
          color: token.trim() ? "#fff" : "var(--color-text-muted)",
          fontSize: 13, fontWeight: 600,
          cursor: saving || !token.trim() ? "not-allowed" : "pointer",
          alignSelf: "flex-start",
          transition: "all 200ms",
          boxShadow: token.trim() ? "0 4px 12px rgba(79,110,247,0.25)" : "none",
        }}
      >
        {saving
          ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          : <Key size={13} />
        }
        Save Token
      </button>
    </div>
  );
}

// ── Alli connection card ───────────────────────────────────────────────────────

function AlliConnectionCard() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [status, setStatus]     = useState<AlliStatus | null>(null);
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [authTab, setAuthTab]   = useState<"oauth" | "manual">("manual");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/alli/status");
      setStatus(await res.json() as AlliStatus);
    } catch {
      setStatus({ connected: false });
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Handle OAuth redirect-back params
  useEffect(() => {
    const connected = searchParams.get("alli_connected");
    const error     = searchParams.get("alli_error");
    if (connected) {
      setFeedback({ type: "success", msg: "Successfully connected to Alli!" });
      fetchStatus();
      router.replace("/settings", { scroll: false });
    }
    if (error) {
      setFeedback({ type: "error", msg: error });
      router.replace("/settings", { scroll: false });
    }
  }, [searchParams, fetchStatus, router]);

  async function handleDisconnect() {
    if (!confirm("Disconnect from Alli? You will need to re-authenticate to sync creatives.")) return;
    setLoading(true);
    try {
      await fetch("/api/auth/alli/disconnect", { method: "DELETE" });
      setFeedback({ type: "success", msg: "Disconnected from Alli." });
      setStatus({ connected: false });
    } catch {
      setFeedback({ type: "error", msg: "Disconnect failed — try again." });
    } finally {
      setLoading(false);
    }
  }

  const expiresIn = status?.expires_at
    ? Math.max(0, Math.floor((new Date(status.expires_at).getTime() - Date.now()) / 60000))
    : null;

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      {/* Card header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "20px 24px",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "linear-gradient(135deg, #4f6ef7, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: "0 4px 16px rgba(79,110,247,0.3)",
        }}>
          <Zap size={22} color="#fff" fill="#fff" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.01em" }}>
              PMG Alli Platform
            </h2>
            <StatusBadge status={status} />
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Sync ad creatives from the Alli DAM, Brand Media, and Creative Studio.
          </p>
        </div>

        <button
          onClick={async () => { setLoading(true); await fetchStatus(); setLoading(false); }}
          disabled={loading}
          title="Refresh connection status"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8,
            border: "1px solid var(--color-border)", background: "transparent",
            color: "var(--color-text-muted)",
            cursor: loading ? "not-allowed" : "pointer", flexShrink: 0,
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 24px",
          background: feedback.type === "success" ? "rgba(34,211,160,0.08)" : "rgba(244,63,94,0.08)",
          borderBottom: "1px solid var(--color-border)",
        }}>
          {feedback.type === "success"
            ? <CheckCircle2 size={15} color="#22d3a0" style={{ flexShrink: 0, marginTop: 1 }} />
            : <AlertCircle  size={15} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
          }
          <p style={{ fontSize: 13, color: feedback.type === "success" ? "#22d3a0" : "#f43f5e" }}>
            {feedback.msg}
          </p>
          <button
            onClick={() => setFeedback(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 16, lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: "20px 24px" }}>
        {status?.connected ? (
          /* ── Connected state ─────────────────────────────────────────────── */
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <InfoTile
                icon={<Clock size={13} />}
                label="Token expires"
                value={status.scope === "manual" ? "Session token" : expiresIn !== null ? `${expiresIn} min` : "—"}
                warn={!!(status.needs_refresh && status.scope !== "manual")}
              />
              <InfoTile
                icon={<ShieldCheck size={13} />}
                label="Auth method"
                value={status.scope === "manual" ? "Manual token" : "OAuth 2.1 PKCE"}
              />
            </div>

            {status.scope === "manual" && (
              <div style={{
                display: "flex", gap: 8, padding: "10px 12px",
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 10,
              }}>
                <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#f59e0b" }}>
                  Using a manually-provided token. Alli session tokens typically expire with your browser session.
                  Re-paste a fresh token when this stops working.
                </p>
              </div>
            )}

            <button
              onClick={handleDisconnect}
              disabled={loading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "9px 18px", borderRadius: 9,
                border: "1px solid rgba(244,63,94,0.35)",
                background: "rgba(244,63,94,0.06)",
                color: "#f43f5e", fontSize: 13, fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer", alignSelf: "flex-start",
              }}
            >
              {loading
                ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                : <Unplug size={13} />
              }
              Disconnect
            </button>
          </div>
        ) : (
          /* ── Disconnected state ──────────────────────────────────────────── */
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* What syncs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Digital Asset Manager", desc: "Ad files by channel" },
                { label: "Brand Media",            desc: "Brand-level assets" },
                { label: "Creative Studio",        desc: "Platform-built creatives" },
              ].map(({ label, desc }) => (
                <div key={label} style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{desc}</p>
                </div>
              ))}
            </div>

            {/* Auth method tabs */}
            <div>
              <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-border)", marginBottom: 16 }}>
                {(["manual", "oauth"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAuthTab(tab)}
                    style={{
                      padding: "8px 16px", background: "none", border: "none",
                      borderBottom: authTab === tab ? "2px solid var(--color-accent)" : "2px solid transparent",
                      marginBottom: -1,
                      color: authTab === tab ? "var(--color-accent)" : "var(--color-text-muted)",
                      fontSize: 13, fontWeight: authTab === tab ? 600 : 400,
                      cursor: "pointer", transition: "all 150ms",
                    }}
                  >
                    {tab === "manual" ? "🔑 Paste Token" : "🔐 OAuth (requires setup)"}
                  </button>
                ))}
              </div>

              {authTab === "manual" ? (
                <ManualTokenForm
                  onSuccess={() => {
                    setFeedback({ type: "success", msg: "Token saved — Alli is now connected." });
                    fetchStatus();
                  }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* OAuth pending registration notice */}
                  <div style={{
                    display: "flex", gap: 8, padding: "12px 14px",
                    background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: 10,
                  }}>
                    <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>
                        Redirect URI registration required
                      </p>
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                        The Alli OAuth flow requires your app domain to be registered as an allowed redirect URI.
                        Ask the Alli team (Maxwell Thomason) to add{" "}
                        <code style={{ fontSize: 11, background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: 3 }}>
                          …/api/auth/alli/callback
                        </code>{" "}
                        for your Vercel domain, then this flow will work automatically.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => { window.location.href = "/api/auth/alli/authorize?redirect_after=/settings"; }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 22px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #4f6ef7, #8b5cf6)",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      cursor: "pointer", boxShadow: "0 4px 16px rgba(79,110,247,0.3)",
                      alignSelf: "flex-start",
                    }}
                  >
                    <Plug size={14} />
                    Try OAuth Anyway
                  </button>

                  <a
                    href="https://mcp.alliplatform.com/health"
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 12, color: "var(--color-text-muted)", textDecoration: "none",
                    }}
                  >
                    <ExternalLink size={11} />
                    Alli API health status
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── InfoTile ───────────────────────────────────────────────────────────────────

function InfoTile({ icon, label, value, warn }: {
  icon: React.ReactNode; label: string; value: string; warn?: boolean;
}) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10,
      background: "var(--color-surface-2)",
      border: `1px solid ${warn ? "rgba(245,158,11,0.3)" : "var(--color-border)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, color: "var(--color-text-muted)" }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: warn ? "#f59e0b" : "var(--color-text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div style={{ padding: "28px 28px 64px", maxWidth: 800 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 700,
          color: "var(--color-text-primary)", letterSpacing: "-0.025em", marginBottom: 6,
        }}>Settings</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          Configure API connections and data sources for creative ingestion.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16,
        }}>
          API Connections
        </p>

        <Suspense fallback={<div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Loading…</div>}>
          <AlliConnectionCard />
        </Suspense>
      </section>

      <style>{`
        @keyframes spin  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        input::placeholder { color: var(--color-text-muted); opacity: 0.6; }
      `}</style>
    </div>
  );
}
