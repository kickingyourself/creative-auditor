"use client";

/**
 * app/campaigns/new/page.tsx
 *
 * Thin creation page — user fills brand + name, clicks "Create Campaign",
 * record is persisted, then redirects to /campaigns/[id] (the unified builder).
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Layers, ChevronRight, Tag, Loader2, Check,
  CalendarDays, AlignLeft,
} from "lucide-react";
import Link from "next/link";

// ── Brand selector ────────────────────────────────────────────────────────────

interface BrandOption { id: string; name: string; logo_url: string | null; }

function BrandSelector({ value, onChange }: {
  value: BrandOption | null;
  onChange: (b: BrandOption | null) => void;
}) {
  const [query, setQuery]     = useState("");
  const [brands, setBrands]   = useState<BrandOption[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/brands")
      .then(r => r.json())
      .then(d => setBrands(d.brands ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = brands.filter(b => b.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: value ? "var(--color-text-primary)" : "var(--color-text-muted)", fontSize: 13, fontWeight: value ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
        {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Tag size={13} color="var(--color-text-muted)" />}
        {value?.name ?? "Select brand…"}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, width: 240, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-border)" }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search brands…" style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12, color: "var(--color-text-primary)" }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.length === 0
              ? <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>No brands found</p>
              : filtered.map(b => (
                <button key={b.id} type="button" onClick={() => { onChange(b); setOpen(false); setQuery(""); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: value?.id === b.id ? "rgba(79,179,186,0.08)" : "transparent", border: "none", cursor: "pointer", color: "var(--color-text-primary)", fontSize: 13, textAlign: "left" }}>
                  {b.logo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={b.logo_url} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover" }} />
                    : <div style={{ width: 20, height: 20, borderRadius: 4, background: "var(--color-border)", flexShrink: 0 }} />
                  }
                  {b.name}
                </button>
              ))
            }
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const [brand, setBrand]           = useState<BrandOption | null>(null);
  const [name, setName]             = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const canCreate = !!brand && !!name.trim();

  async function handleCreate() {
    if (!canCreate) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand!.id, name: name.trim(), start_date: startDate || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 860, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 32 }}>
        <Link href="/campaigns" style={{ fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          <Layers size={13} color="var(--color-accent)" /> Campaigns
        </Link>
        <ChevronRight size={13} color="var(--color-text-muted)" />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>New Campaign</span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
        <BrandSelector value={brand} onChange={setBrand} />

        <button
          id="btn-create-campaign"
          type="button"
          onClick={handleCreate}
          disabled={!canCreate || saving}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 9, border: "none", background: canCreate && !saving ? "linear-gradient(135deg, var(--color-accent), #22d3a0)" : "var(--color-surface-2)", color: canCreate && !saving ? "#fff" : "var(--color-text-muted)", fontSize: 13, fontWeight: 700, cursor: canCreate && !saving ? "pointer" : "not-allowed", boxShadow: canCreate && !saving ? "0 2px 10px rgba(79,179,186,0.3)" : "none", transition: "all 200ms ease", flexShrink: 0 }}
        >
          {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Creating…</> : <><Check size={13} /> Create Campaign</>}
        </button>
      </div>

      {/* Campaign name */}
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleCreate()}
        placeholder="Campaign name…"
        autoFocus
        style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: "var(--color-text-primary)", background: "transparent", border: "none", borderBottom: `2px solid ${canCreate ? "var(--color-accent)" : "rgba(255,255,255,0.12)"}`, outline: "none", width: "100%", padding: "4px 0 10px", marginBottom: 24, transition: "border-color 200ms" }}
      />

      {/* Description + Start Date */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "16px 24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <AlignLeft size={11} color="var(--color-text-muted)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Description</span>
          </div>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional campaign brief…"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-primary)", fontSize: 13, outline: "none" }}
          />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <CalendarDays size={11} color="var(--color-text-muted)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Start Date</span>
          </div>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-primary)", fontSize: 13, outline: "none" }}
          />
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, padding: "10px 14px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: "#f43f5e" }}>{error}</span>
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 12, color: "var(--color-text-muted)" }}>
        Select a brand and enter a name to continue. You&apos;ll add creatives on the next screen.
      </p>
    </div>
  );
}
