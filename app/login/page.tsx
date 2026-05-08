"use client";

/**
 * app/login/page.tsx
 *
 * Full-screen password challenge page.
 * Renders over the top of everything (position: fixed, z-index: 9999)
 * so it doesn't need its own layout — no sidebar or header visible.
 *
 * useSearchParams() is isolated inside <LoginForm> which is wrapped in
 * <Suspense> — required by Next.js to avoid prerender errors.
 */

import { Suspense, useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authenticate, AuthState } from "@/actions/authenticate";
import { Eye, EyeOff, Lock, Loader2, ArrowRight } from "lucide-react";

const initialState: AuthState = { status: "idle" };

// ─── Shared full-screen shell ─────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#161614",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid texture */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(79,179,186,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(79,179,186,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            pointerEvents: "none",
          }}
        />
        {/* Radial glow */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(79,179,186,0.07) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        {/* Card area */}
        <div
          style={{
            position: "relative",
            width: "min(420px, 90vw)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            animation: "fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {/* Logo mark */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "14px",
                background: "linear-gradient(135deg, #4fb3ba, #2d8a91)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 32px rgba(79,179,186,0.35)",
              }}
            >
              <Lock size={22} color="#fff" />
            </div>
            <div style={{ textAlign: "center" }}>
              <h1
                style={{
                  fontFamily: '"PP Right Grotesk", "Space Grotesk", sans-serif',
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#f0efe8",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                }}
              >
                Creative Audit
              </h1>
              <p
                style={{
                  fontSize: "13px",
                  color: "#58584f",
                  marginTop: "5px",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                PMG · Ad Intelligence Platform
              </p>
            </div>
          </div>

          {children}

          {/* Footer */}
          <p style={{ fontSize: "11px", color: "#38382f", letterSpacing: "0.05em" }}>
            © {new Date().getFullYear()} PMG. All rights reserved.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-4px); }
          60%       { transform: translateX(4px); }
          75%       { transform: translateX(-2px); }
          90%       { transform: translateX(2px); }
        }
      `}</style>
    </>
  );
}

// ─── Suspense fallback — just the shell, no form ─────────────────────────────

function LoginFallback() {
  return (
    <PageShell>
      <div
        style={{
          width: "100%",
          background: "#1e1e1c",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "18px",
          padding: "28px",
          height: "180px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      />
    </PageShell>
  );
}

// ─── Inner form — uses useSearchParams ───────────────────────────────────────

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";

  const [state, formAction, pending] = useActionState(authenticate, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Shake input + refocus on error
  useEffect(() => {
    if (state.status === "error") {
      setShakeKey((k) => k + 1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [state]);

  return (
    <PageShell>
      {/* Form card */}
      <div
        style={{
          width: "100%",
          background: "#1e1e1c",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "18px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#f0efe8", marginBottom: "4px" }}>
            Enter access password
          </p>
          <p style={{ fontSize: "13px", color: "#58584f" }}>
            This tool is for internal PMG use only.
          </p>
        </div>

        <form
          id="login-form"
          action={formAction}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          {/* Hidden from field — preserves post-login redirect */}
          <input type="hidden" name="from" value={from} />

          {/* Password input */}
          <div
            key={shakeKey}
            style={{
              position: "relative",
              animation: shakeKey > 0 ? "shake 0.4s cubic-bezier(.36,.07,.19,.97) both" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "#272724",
                border: `1px solid ${state.status === "error" ? "rgba(200,90,74,0.5)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: "10px",
                padding: "12px 14px",
                transition: "border-color 200ms ease",
              }}
            >
              <Lock
                size={15}
                color={state.status === "error" ? "#c85a4a" : "#58584f"}
                style={{ flexShrink: 0 }}
              />
              <input
                id="password-input"
                ref={inputRef}
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Access password"
                disabled={pending}
                autoComplete="current-password"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "#f0efe8",
                  fontSize: "14px",
                  width: "100%",
                  letterSpacing: showPassword ? "normal" : "0.1em",
                }}
              />
              <button
                type="button"
                id="btn-toggle-password"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#58584f",
                  padding: "2px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Error message */}
          {state.status === "error" && (
            <p
              role="alert"
              style={{
                fontSize: "12px",
                color: "#c85a4a",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                animation: "fadeInUp 0.2s ease both",
              }}
            >
              <span aria-hidden>✕</span> {state.message}
            </p>
          )}

          {/* Submit button */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={pending}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "12px 20px",
              borderRadius: "10px",
              border: "none",
              background: pending ? "#272724" : "linear-gradient(135deg, #4fb3ba, #2d8a91)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: pending ? "not-allowed" : "pointer",
              opacity: pending ? 0.7 : 1,
              transition: "opacity 200ms ease, transform 150ms ease, box-shadow 200ms ease",
              boxShadow: pending ? "none" : "0 4px 18px rgba(79,179,186,0.35)",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              if (!pending) {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 24px rgba(79,179,186,0.45)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                pending ? "none" : "0 4px 18px rgba(79,179,186,0.35)";
            }}
          >
            {pending ? (
              <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Checking…</>
            ) : (
              <>Enter <ArrowRight size={15} /></>
            )}
          </button>
        </form>
      </div>
    </PageShell>
  );
}

// ─── Page export — Suspense boundary required for useSearchParams ─────────────

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
