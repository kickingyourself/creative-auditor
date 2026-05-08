"use client";

import { useActionState, useEffect, useRef } from "react";
import { addBrand, AddBrandState } from "@/actions/add-brand";
import {
  X,
  Building2,
  Globe,
  Image,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddBrandModalProps {
  open: boolean;
  onClose: () => void;
}

const initialState: AddBrandState = { status: "idle" };

// ─── Field row ────────────────────────────────────────────────────────────────

function Field({
  id, label, name, icon, placeholder, required, type = "text",
}: {
  id: string;
  label: string;
  name: string;
  icon: React.ReactNode;
  placeholder: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label
        htmlFor={id}
        style={{
          fontSize: "12px", fontWeight: 600,
          color: "var(--color-text-secondary)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}
      >
        {label}
        {required && <span style={{ color: "#f43f5e", marginLeft: 3 }}>*</span>}
      </label>
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: "8px", padding: "10px 14px",
      }}>
        <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{icon}</span>
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            border: "none", outline: "none",
            background: "transparent",
            color: "var(--color-text-primary)",
            fontSize: "13px", width: "100%",
          }}
        />
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function AddBrandModal({ open, onClose }: AddBrandModalProps) {
  const [state, formAction, pending] = useActionState(addBrand, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Close and reset form on success
  useEffect(() => {
    if (state.status === "success") {
      const timer = setTimeout(() => {
        onClose();
        formRef.current?.reset();
      }, 1200); // brief pause so user sees the success state
      return () => clearTimeout(timer);
    }
  }, [state, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        id="add-brand-backdrop"
        onClick={() => { if (!pending) onClose(); }}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          animation: "fadeIn 150ms ease",
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-brand-title"
        id="add-brand-modal"
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 51,
          width: "min(480px, 92vw)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "18px",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "22px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          animation: "slideUp 200ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "10px",
            background: "rgba(108,99,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Building2 size={18} color="#4fb3ba" />
          </div>
          <div style={{ flex: 1 }}>
            <h2
              id="add-brand-title"
              style={{
                fontSize: "16px", fontWeight: 700,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.025em",
              }}
            >
              Add Brand
            </h2>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
              Track a new brand's creative output
            </p>
          </div>
          <button
            id="btn-close-add-brand"
            onClick={() => { if (!pending) onClose(); }}
            disabled={pending}
            style={{
              background: "none", border: "none", cursor: pending ? "not-allowed" : "pointer",
              color: "var(--color-text-muted)", padding: "4px",
              borderRadius: "6px", flexShrink: 0,
              opacity: pending ? 0.4 : 1,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form
          id="form-add-brand"
          ref={formRef}
          action={formAction}
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <Field
            id="brand-name"
            label="Brand Name"
            name="name"
            icon={<Building2 size={14} />}
            placeholder="e.g. Nike, Notion, Patagonia…"
            required
          />
          <Field
            id="brand-website"
            label="Website URL"
            name="website_url"
            icon={<Globe size={14} />}
            placeholder="https://brand.com (optional)"
          />
          <Field
            id="brand-logo"
            label="Logo URL"
            name="logo_url"
            icon={<Image size={14} />}
            placeholder="https://cdn.brand.com/logo.png (optional)"
          />

          {/* Status feedback */}
          {state.status === "success" && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "12px 14px",
              background: "rgba(34,211,160,0.08)",
              border: "1px solid rgba(34,211,160,0.2)",
              borderRadius: "8px",
            }}>
              <CheckCircle2 size={15} color="#22d3a0" />
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#22d3a0" }}>
                {state.brand.name} added! Refreshing…
              </p>
            </div>
          )}
          {state.status === "error" && (
            <div style={{
              display: "flex", gap: "8px",
              padding: "12px 14px",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.2)",
              borderRadius: "8px",
            }}>
              <AlertCircle size={15} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "#f43f5e" }}>{state.code}</p>
                <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{state.message}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              type="button"
              id="btn-cancel-add-brand"
              onClick={() => { if (!pending) onClose(); }}
              disabled={pending}
              style={{
                flex: 1, padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-secondary)",
                fontSize: "13px", fontWeight: 500,
                cursor: pending ? "not-allowed" : "pointer",
                opacity: pending ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              id="btn-submit-add-brand"
              type="submit"
              disabled={pending || state.status === "success"}
              style={{
                flex: 2, padding: "10px",
                borderRadius: "8px", border: "none",
                background: pending || state.status === "success"
                  ? "var(--color-surface-2)"
                  : "linear-gradient(135deg, #4fb3ba, #2d8a91)",
                color: "#fff",
                fontSize: "13px", fontWeight: 600,
                cursor: pending || state.status === "success" ? "not-allowed" : "pointer",
                opacity: pending || state.status === "success" ? 0.7 : 1,
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px",
                transition: "opacity 200ms",
                boxShadow: pending ? "none" : "0 4px 14px rgba(108,99,255,0.3)",
              }}
            >
              {pending ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Adding brand…</>
              ) : (
                <><Building2 size={14} />Add Brand</>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
