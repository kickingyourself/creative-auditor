"use client";

/**
 * components/ComparisonBuilder.tsx
 *
 * Client component that powers both /competitive/new and /competitive/[id].
 * Manages up to 4 campaign columns with independent data fetching per column.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Save, Crown, Layers, ChevronDown } from "lucide-react";
import { CreativeGrid } from "@/components/CreativeGrid";
import type { Creative } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CampaignOption {
  id: string;
  name: string;
  brand_id: string;
  brands: { id: string; name: string; logo_url: string | null } | null;
}

interface ChannelSection {
  key: string;
  label: string;
  items: { creative: Creative; brandLogoUrl: string | null }[];
}

interface ColumnData {
  campaignName: string;
  brandName: string;
  brandLogoUrl: string | null;
  channels: ChannelSection[];
}

interface Props {
  allCampaigns: CampaignOption[];
  initialCampaignIds?: string[];
  snapshotId?: string;
  snapshotName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function BrandAvatar({ name, logoUrl, size = 22 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} style={{ width: size, height: size, borderRadius: 4, objectFit: "contain", flexShrink: 0 }} />
    );
  }
  const initials = name.split(/\s+/).map(w => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
  return (
    <div style={{
      width: size, height: size, borderRadius: 4, background: "rgba(79,179,186,0.15)",
      border: "1px solid rgba(79,179,186,0.25)", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.4, fontWeight: 800,
      color: "var(--color-accent)", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ComparisonBuilder({ allCampaigns, initialCampaignIds, snapshotId, snapshotName }: Props) {
  const router = useRouter();

  const [columns, setColumns] = useState<(string | null)[]>(
    initialCampaignIds?.length ? [...initialCampaignIds] : [null]
  );
  const [colData, setColData] = useState<Record<string, ColumnData & { loading: boolean; error?: string }>>({});
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState(snapshotName ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Group campaigns by brand for the dropdown optgroups
  const brandGroups = (() => {
    const map = new Map<string, { brandName: string; campaigns: CampaignOption[] }>();
    for (const c of allCampaigns) {
      const bn = c.brands?.name ?? "Unknown Brand";
      if (!map.has(bn)) map.set(bn, { brandName: bn, campaigns: [] });
      map.get(bn)!.campaigns.push(c);
    }
    return Array.from(map.values()).sort((a, b) => a.brandName.localeCompare(b.brandName));
  })();

  const loadColumn = useCallback(async (campaignId: string) => {
    // Always include channels:[] so renders never see undefined.channels
    setColData(prev => ({
      ...prev,
      [campaignId]: { campaignName: "", brandName: "", brandLogoUrl: null, channels: [], loading: true },
    }));
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/creatives`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`API ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
      }
      const json = await res.json() as {
        campaign: { name: string; brand: { name: string; logo_url: string | null } | null };
        channels: ChannelSection[];
      };
      if (!json?.campaign) throw new Error("Unexpected response — no campaign object returned");
      setColData(prev => ({
        ...prev,
        [campaignId]: {
          campaignName: json.campaign.name,
          brandName: json.campaign.brand?.name ?? "",
          brandLogoUrl: json.campaign.brand?.logo_url ?? null,
          channels: json.channels ?? [],
          loading: false,
        },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setColData(prev => ({
        ...prev,
        [campaignId]: { ...prev[campaignId], channels: prev[campaignId]?.channels ?? [], loading: false, error: msg },
      }));
    }
  }, []);

  // Load initial campaigns on mount
  useEffect(() => {
    for (const id of initialCampaignIds ?? []) {
      if (id) loadColumn(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCampaign(colIdx: number, campaignId: string) {
    setColumns(prev => {
      const next = [...prev];
      next[colIdx] = campaignId || null;
      return next;
    });
    if (campaignId && !colData[campaignId]) {
      loadColumn(campaignId);
    }
  }

  function addColumn() {
    if (columns.length < 4) setColumns(prev => [...prev, null]);
  }

  function removeColumn(idx: number) {
    setColumns(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    const ids = columns.filter(Boolean) as string[];
    if (!ids.length || !saveName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const url = snapshotId
        ? `/api/competitive-snapshots/${snapshotId}`
        : "/api/competitive-snapshots";
      const res = await fetch(url, {
        method: snapshotId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: saveName.trim(), campaign_ids: ids }),
      });
      if (!res.ok) {
        // apiError() returns: { error: string, code: string, detail?: string }
        const body = await res.json().catch(() => ({})) as { error?: string; code?: string; detail?: string };
        throw new Error(body?.detail ?? body?.error ?? `Save failed (HTTP ${res.status})`);
      }
      // Hard navigate — bypasses Next.js router cache so page re-fetches from DB
      window.location.href = "/competitive";
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const hasSelections = columns.some(Boolean);
  const colCount = columns.length;

  return (
    <>
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "20px 24px 16px", borderBottom: "1px solid var(--color-border)",
        position: "sticky", top: 0, background: "var(--color-bg)", zIndex: 20,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.03em" }}>
            {snapshotId ? saveName || "Competitive View" : "New Comparison"}
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            {colCount} campaign{colCount !== 1 ? "s" : ""} · up to 4
          </p>
        </div>

        {colCount < 4 && (
          <button
            onClick={addColumn}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)", color: "var(--color-text-secondary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add Campaign
          </button>
        )}

        {hasSelections && (
          <button
            onClick={() => setSaveOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: "var(--color-accent)", color: "#0a1a1b",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            <Save size={14} />
            {snapshotId ? "Update Snapshot" : "Save Snapshot"}
          </button>
        )}
      </div>

      {/* ── Columns ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 0,
        alignItems: "flex-start",
        minHeight: "calc(100vh - 65px)",
      }}>
        {columns.map((campaignId, idx) => {
          const data = campaignId ? colData[campaignId] : undefined;
          const isLast = idx === columns.length - 1;

          return (
            <div
              key={idx}
              style={{
                flex: 1, minWidth: 0,
                borderRight: isLast ? "none" : "1px solid var(--color-border)",
                display: "flex", flexDirection: "column",
              }}
            >
              {/* Column header */}
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                position: "sticky", top: 65, zIndex: 10,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                {data && (
                  <BrandAvatar name={data.brandName} logoUrl={data.brandLogoUrl} size={20} />
                )}

                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                  <select
                    value={campaignId ?? ""}
                    onChange={e => selectCampaign(idx, e.target.value)}
                    style={{
                      width: "100%", appearance: "none",
                      background: campaignId ? "transparent" : "var(--color-surface-2)",
                      border: campaignId ? "none" : "1px solid var(--color-border)",
                      borderRadius: 6, padding: campaignId ? "0" : "6px 28px 6px 10px",
                      color: campaignId ? "var(--color-text-primary)" : "var(--color-text-muted)",
                      fontSize: 13, fontWeight: campaignId ? 600 : 400,
                      cursor: "pointer", outline: "none",
                    }}
                  >
                    <option value="">Select a campaign…</option>
                    {brandGroups.map(group => (
                      <optgroup key={group.brandName} label={group.brandName}>
                        {group.campaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {!campaignId && (
                    <ChevronDown size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--color-text-muted)" }} />
                  )}
                </div>

                <button
                  onClick={() => removeColumn(idx)}
                  title="Remove column"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: 6,
                    background: "none", border: "1px solid var(--color-border)",
                    cursor: "pointer", color: "var(--color-text-muted)", flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>

              {/* Column body */}
              <div style={{ padding: "16px 16px 40px", flex: 1 }}>
                {!campaignId && (
                  <div style={{
                    height: 280, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 10,
                    border: "2px dashed var(--color-border)", borderRadius: 12,
                  }}>
                    <Crown size={28} color="var(--color-text-muted)" style={{ opacity: 0.4 }} />
                    <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
                      Select a campaign<br />to compare
                    </p>
                  </div>
                )}

                {campaignId && data?.loading && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, gap: 8 }}>
                    <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
                    <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</span>
                  </div>
                )}

                {campaignId && !data?.loading && data?.error && (
                  <div style={{
                    padding: "14px 16px", borderRadius: 10, marginTop: 8,
                    background: "rgba(244,63,94,0.06)",
                    border: "1px solid rgba(244,63,94,0.2)",
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#f43f5e", marginBottom: 4 }}>Failed to load creatives</p>
                    <p style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>{data.error}</p>
                  </div>
                )}

                {campaignId && !data?.loading && !data?.error && (data?.channels ?? []).map(ch => (
                  <section key={ch.key} style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <Layers size={13} color="var(--color-text-muted)" />
                      <h2 style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                        textTransform: "uppercase", color: "var(--color-text-muted)",
                      }}>
                        {ch.label}
                      </h2>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: "var(--color-accent)",
                        background: "rgba(79,179,186,0.1)", border: "1px solid rgba(79,179,186,0.2)",
                        padding: "1px 6px", borderRadius: 10,
                      }}>
                        {ch.items.length}
                      </span>
                    </div>
                    <CreativeGrid items={ch.items} />
                  </section>
                ))}

                {campaignId && !data?.loading && !data?.error && (data?.channels ?? []).length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", marginTop: 40 }}>
                    No creatives in this campaign yet.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Save Dialog ──────────────────────────────────────────────────────── */}
      {saveOpen && (
        <div
          onClick={() => !saving && setSaveOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 16, padding: 28,
              maxWidth: 420, width: "100%",
              display: "flex", flexDirection: "column", gap: 20,
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              animation: "modalIn 200ms cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
                {snapshotId ? "Update Snapshot" : "Save Comparison"}
              </p>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                Give this competitive view a name to save it for later.
              </p>
            </div>

            <div>
              <label htmlFor="snapshot-name" style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Snapshot Name
              </label>
              <input
                id="snapshot-name"
                autoFocus
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setSaveOpen(false); }}
                placeholder="Nike vs Adidas — Q2 2024"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8, padding: "10px 12px",
                  color: "var(--color-text-primary)", fontSize: 13, outline: "none",
                }}
              />
            </div>


            {saveError && (
              <div style={{
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(244,63,94,0.08)",
                border: "1px solid rgba(244,63,94,0.25)",
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#f43f5e", marginBottom: 2 }}>Save failed</p>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>{saveError}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setSaveOpen(false); setSaveError(null); }}
                disabled={saving}
                style={{
                  padding: "9px 18px", borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "none", color: "var(--color-text-secondary)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !saveName.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 20px", borderRadius: 8, border: "none",
                  background: saveName.trim() ? "var(--color-accent)" : "var(--color-surface-2)",
                  color: saveName.trim() ? "#0a1a1b" : "var(--color-text-muted)",
                  fontSize: 13, fontWeight: 700,
                  cursor: saving || !saveName.trim() ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Save size={13} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  );
}
