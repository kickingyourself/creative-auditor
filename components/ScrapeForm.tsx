"use client";

import { useActionState, useState } from "react";
import { scrapeHomepage, ScrapeState } from "@/actions/scrape-homepage";
import {
  Globe,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { CampaignPicker } from "@/components/CampaignPicker";
import type { CampaignOption } from "@/components/CampaignPicker";

const initialState: ScrapeState = { status: "idle" };

interface ScrapeFormProps {
  /** Pre-bound brand_id so the form doesn't need a visible input for it */
  brandId: string;
  brandName?: string;
}

export function ScrapeForm({ brandId, brandName }: ScrapeFormProps) {
  const [state, formAction, pending] = useActionState(
    scrapeHomepage,
    initialState
  );
  const [campaign, setCampaign] = useState<CampaignOption | null>(null);

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
            background: "rgba(34,211,160,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Camera size={18} color="#22d3a0" />
        </div>
        <div>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Capture Homepage Creative
          </h3>
          <p
            style={{
              fontSize: "12px",
              color: "var(--color-text-secondary)",
              marginTop: "2px",
            }}
          >
            {brandName
              ? `Scrape a hero screenshot for ${brandName}`
              : "Navigate to a URL and capture a viewport screenshot"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form
        id={`scrape-form-${brandId}`}
        action={formAction}
        style={{ display: "flex", flexDirection: "column", gap: "14px" }}
      >
        {/* Hidden brand_id */}
        <input type="hidden" name="brand_id" value={brandId} />

        {/* URL Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            htmlFor={`scrape-url-${brandId}`}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Homepage URL
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: "8px",
              padding: "10px 14px",
              transition: "border-color 150ms ease",
            }}
          >
            <Globe size={15} color="var(--color-text-muted)" />
            <input
              id={`scrape-url-${brandId}`}
              name="url"
              type="text"
              required
              placeholder="https://brand.com or brand.com"
              disabled={pending}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--color-text-primary)",
                fontSize: "13px",
                width: "100%",
                opacity: pending ? 0.5 : 1,
              }}
            />
          </div>
        </div>

        {/* Optional campaign — resolved to UUID via picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Campaign{" "}
            <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          {/* Hidden input carries the resolved UUID to the server action */}
          <input type="hidden" name="campaign_id" value={campaign?.id ?? ""} />
          <CampaignPicker
            brandId={brandId}
            instanceId={`scrape-${brandId}`}
            disabled={pending}
            onChange={setCampaign}
          />
        </div>

        {/* Submit */}
        <button
          id={`btn-scrape-${brandId}`}
          type="submit"
          disabled={pending}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "11px 20px",
            borderRadius: "8px",
            border: "none",
            background: pending
              ? "var(--color-surface-2)"
              : "linear-gradient(135deg, #22d3a0, #0ea5e9)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: pending ? "not-allowed" : "pointer",
            transition: "opacity 200ms ease, transform 150ms ease",
            opacity: pending ? 0.7 : 1,
            boxShadow: pending ? "none" : "0 4px 12px rgba(34,211,160,0.25)",
          }}
          onMouseEnter={(e) => {
            if (!pending) {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 6px 20px rgba(34,211,160,0.35)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 12px rgba(34,211,160,0.25)";
          }}
        >
          {pending ? (
            <>
              <Loader2
                size={15}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Launching browser…
            </>
          ) : (
            <>
              <Camera size={15} />
              Capture Screenshot
            </>
          )}
        </button>
      </form>

      {/* Status feedback */}
      {state.status === "success" && (
        <div
          role="status"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "14px",
            background: "rgba(34,211,160,0.08)",
            border: "1px solid rgba(34,211,160,0.2)",
            borderRadius: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} color="#22d3a0" />
            <p
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#22d3a0",
              }}
            >
              Screenshot captured and saved!
            </p>
          </div>

          {/* Thumbnail preview */}
          {state.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.thumbnailUrl}
              alt="Captured screenshot preview"
              style={{
                width: "100%",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                objectFit: "cover",
                maxHeight: 180,
              }}
            />
          )}

          <a
            href={state.sourceUrl}
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
            {state.sourceUrl}
          </a>
          <p style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            Creative ID: <code style={{ fontFamily: "monospace" }}>{state.creativeId}</code>
          </p>
        </div>
      )}

      {state.status === "error" && (
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
            <p
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#f43f5e",
                marginBottom: "3px",
              }}
            >
              {state.code}
            </p>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>
              {state.message}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
