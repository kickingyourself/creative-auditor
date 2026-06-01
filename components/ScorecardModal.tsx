"use client";

/**
 * components/ScorecardModal.tsx
 *
 * Creative director scorecard submission modal.
 * Opened from a creative card in a campaign context.
 * campaign_id is required — scorecards are always campaign-scoped.
 *
 * Dimensions:
 *   Concept · Craft · Brand Fit · Message · CTA
 *
 * Tags (multi-select chips):
 *   Strengths   — positive feedback
 *   Improvements — areas to address
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Star, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { Creative } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const DIMENSIONS = [
  { key: "score_concept",    label: "Concept",    hint: "Is the idea strong and original?" },
  { key: "score_craft",      label: "Craft",      hint: "Is the execution high quality?" },
  { key: "score_brand_fit",  label: "Brand Fit",  hint: "Does it feel on-brand?" },
  { key: "score_message",    label: "Message",    hint: "Is the message clear and compelling?" },
  { key: "score_cta",        label: "CTA",        hint: "Is there a clear call-to-action?" },
] as const;

type DimKey = typeof DIMENSIONS[number]["key"];

const STRENGTH_TAGS  = ["On-brand", "Strong hook", "Clear CTA", "High production value", "Emotionally resonant", "Original concept", "Good pacing", "Memorable"];
const IMPROVE_TAGS   = ["Weak CTA", "Off-brand", "Too long", "Unclear message", "Low energy", "Generic concept", "Poor audio", "Visual clutter"];

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({
  value, onChange, label, hint,
}: {
  value: number | null; onChange: (v: number) => void; label: string; hint: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const displayed = hover ?? value ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {label}
        </span>
        <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{hint}</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 2, lineHeight: 0, transition: "transform 120ms",
              transform: hover === n ? "scale(1.25)" : "none",
            }}
          >
            <Star
              size={22}
              fill={n <= displayed ? "#f59e0b" : "transparent"}
              stroke={n <= displayed ? "#f59e0b" : "var(--color-border)"}
              strokeWidth={1.5}
            />
          </button>
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange(0)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--color-text-muted)", padding: "0 4px", alignSelf: "center" }}
          >
            clear
          </button>
        )}
      </div>
    </div>
  );
}

function TagChips({
  tags, selected, onToggle, color,
}: {
  tags: string[]; selected: string[]; onToggle: (t: string) => void; color: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {tags.map((t) => {
        const active = selected.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              border: `1px solid ${active ? color : "var(--color-border)"}`,
              background: active ? `${color}18` : "transparent",
              color: active ? color : "var(--color-text-secondary)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 120ms",
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  creative: Creative;
  campaignId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ScorecardModal({ creative, campaignId, onClose, onSuccess }: Props) {
  const [reviewerName, setReviewerName] = useState("");
  const [scores, setScores]             = useState<Partial<Record<DimKey, number>>>({});
  const [strengths, setStrengths]       = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [notes, setNotes]               = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [done, setDone]                 = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [mounted, setMounted]           = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  // Computed overall
  const dimValues = DIMENSIONS.map(d => scores[d.key]).filter((v): v is number => v != null);
  const computedOverall = dimValues.length > 0
    ? Math.round(dimValues.reduce((s, v) => s + v, 0) / dimValues.length * 10) / 10
    : null;

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewerName.trim()) { setError("Reviewer name is required."); return; }
    setError(null); setSubmitting(true);

    try {
      const res = await fetch("/api/scorecards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creative_id:     creative.id,
          campaign_id:     campaignId,
          reviewer_name:   reviewerName.trim(),
          ...scores,
          score_overall:   computedOverall,
          strengths,
          improvements,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setDone(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  const modal = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 18,
        width: "100%",
        maxWidth: 560,
        maxHeight: "90vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px 14px",
          borderBottom: "1px solid var(--color-border)",
          position: "sticky", top: 0,
          background: "var(--color-surface)",
          zIndex: 1,
          borderRadius: "18px 18px 0 0",
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
              Creative Scorecard
            </p>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
              {creative.title || creative.source_url}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 22px", flex: 1 }}>
          {done ? (
            /* Success state */
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "rgba(34,211,160,0.12)",
                border: "1px solid rgba(34,211,160,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <CheckCircle2 size={26} color="#22d3a0" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 6 }}>
                Scorecard submitted!
              </p>
              {computedOverall && (
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                  Overall score: <strong style={{ color: "#f59e0b" }}>{computedOverall} / 5</strong>
                </p>
              )}
              <button
                onClick={onClose}
                style={{ marginTop: 20, padding: "8px 22px", borderRadius: 9, border: "none", background: "linear-gradient(135deg, var(--color-accent), #22d3a0)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>

              {/* Reviewer name */}
              <div>
                <label htmlFor="reviewer-name" style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Your Name <span style={{ color: "#f43f5e" }}>*</span>
                </label>
                <input
                  id="reviewer-name"
                  type="text"
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  placeholder="Creative Director"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "9px 13px",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-text-primary)",
                    fontSize: 13, outline: "none",
                  }}
                />
              </div>

              {/* Score dimensions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Score each dimension
                </p>
                {DIMENSIONS.map(d => (
                  <StarRating
                    key={d.key}
                    label={d.label}
                    hint={d.hint}
                    value={scores[d.key] ?? null}
                    onChange={v => setScores(prev => v === 0 ? (() => { const n = {...prev}; delete n[d.key]; return n; })() : { ...prev, [d.key]: v })}
                  />
                ))}
              </div>

              {/* Overall summary badge */}
              {computedOverall !== null && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}>
                  <Star size={16} fill="#f59e0b" stroke="#f59e0b" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>
                    Overall: {computedOverall} / 5
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", marginLeft: "auto" }}>
                    Average of {dimValues.length} dimension{dimValues.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              {/* Strengths */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Strengths
                </p>
                <TagChips
                  tags={STRENGTH_TAGS}
                  selected={strengths}
                  onToggle={t => toggleTag(strengths, setStrengths, t)}
                  color="#22d3a0"
                />
              </div>

              {/* Improvements */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  Areas for Improvement
                </p>
                <TagChips
                  tags={IMPROVE_TAGS}
                  selected={improvements}
                  onToggle={t => toggleTag(improvements, setImprovements, t)}
                  color="#f59e0b"
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="scorecard-notes" style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Notes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  id="scorecard-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Anything else to note about this creative…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "9px 13px",
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    color: "var(--color-text-primary)",
                    fontSize: 13, outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {error && (
                <div style={{ display: "flex", gap: 8, padding: 12, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
                  <AlertCircle size={14} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: "#f43f5e" }}>{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!reviewerName.trim() || submitting}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px 24px", borderRadius: 10, border: "none",
                  background: reviewerName.trim() && !submitting
                    ? "linear-gradient(135deg, #f59e0b, #f97316)"
                    : "var(--color-surface-2)",
                  color: reviewerName.trim() && !submitting ? "#fff" : "var(--color-text-muted)",
                  fontSize: 14, fontWeight: 700,
                  cursor: reviewerName.trim() && !submitting ? "pointer" : "not-allowed",
                  opacity: reviewerName.trim() ? 1 : 0.55,
                  transition: "all 200ms",
                }}
              >
                {submitting
                  ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Submitting…</>
                  : <><Star size={15} /> Submit Scorecard</>
                }
              </button>

            </form>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return createPortal(modal, document.body);
}
