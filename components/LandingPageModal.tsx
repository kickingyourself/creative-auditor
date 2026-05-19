"use client";

/**
 * components/LandingPageModal.tsx
 *
 * Focused modal for adding a Landing Page creative in the Campaign Builder.
 * Two modes:
 *   1. "Capture URL"  — runs the existing Playwright scrapeHomepage action
 *   2. "Upload File"  — drag-drop / file-picker upload to Supabase Storage
 *
 * Both modes are pre-scoped to platform = "landing_page" and the supplied
 * brandId / campaignId (if known).
 *
 * Reuses:
 *   - ScrapeForm (already wired to scrapeHomepage server action)
 *   - /api/upload/prepare + /api/upload/register (same flow as ManualUploadForm)
 */

import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  X, Globe, UploadCloud, Camera, Loader2,
  CheckCircle2, AlertCircle, Film, Image as ImageIcon, LibraryBig, Search, Check,
} from "lucide-react";
import { ScrapeForm } from "@/components/ScrapeForm";
import type { Creative } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Required to run the scrape / upload — pass a real UUID once campaign is saved,
   *  or a known brand UUID if one has been selected. */
  brandId: string;
  brandName?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  onClose: () => void;
  /** Called after a successful ingest so the parent can refresh tiles. */
  onSuccess?: () => void;
}

type Tab = "url" | "upload" | "library";

// ── Library panel ─────────────────────────────────────────────────────────────

function LibraryPanel({ brandId, campaignId, onSuccess }: { brandId: string; campaignId?: string | null; onSuccess?: () => void }) {
  const [items, setItems]           = useState<{ creative: Creative; brandLogoUrl: string | null }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);

  useEffect(() => {
    if (!campaignId) { setLoading(false); return; }
    setLoading(true); setFetchError(null);
    fetch(`/api/brands/${brandId}/creatives?exclude_campaign=${campaignId}`)
      .then(r => r.json())
      .then(d => { setItems(d.creatives ?? []); setLoading(false); })
      .catch(() => { setFetchError("Failed to load library."); setLoading(false); });
  }, [brandId, campaignId]);

  const filtered = items.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.creative.title.toLowerCase().includes(q) || i.creative.platform.toLowerCase().includes(q);
  });

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleAssign() {
    if (selected.size === 0 || saving || !campaignId) return;
    setSaving(true); setSaveError(null);
    try {
      const results = await Promise.all(
        Array.from(selected).map(cid =>
          fetch(`/api/creatives/${cid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaign_id: campaignId }),
          }).then(r => r.json())
        )
      );
      if (results.some(r => !r.updated)) { setSaveError("Some creatives could not be assigned."); }
      else { setSaved(true); onSuccess?.(); }
    } catch { setSaveError("Network error — please try again."); }
    finally { setSaving(false); }
  }

  if (!campaignId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <LibraryBig size={28} color="var(--color-text-muted)" style={{ opacity: 0.4 }} />
        <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Save the campaign first to assign library creatives.</p>
      </div>
    );
  }

  if (saved) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(34,211,160,0.15)", border: "1px solid rgba(34,211,160,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle2 size={22} color="#22d3a0" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>Added to campaign!</p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>The campaign grid will refresh automatically.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search size={12} color="var(--color-text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input
          type="text" placeholder="Search creatives…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12, color: "var(--color-text-primary)", outline: "none" }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 8 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Loading library…</span>
        </div>
      ) : fetchError ? (
        <div style={{ display: "flex", gap: 8, padding: 12, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
          <AlertCircle size={13} color="#f43f5e" />
          <p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{fetchError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 24px", border: "1px dashed var(--color-border)", borderRadius: 10 }}>
          <LibraryBig size={24} color="var(--color-text-muted)" style={{ margin: "0 auto 10px", opacity: 0.35 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
            {items.length === 0 ? "No other creatives in this brand's library" : "No results"}
          </p>
          <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            {items.length === 0 ? "All brand creatives are already in this campaign." : "Try a different search term."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
          {filtered.map(item => {
            const sel = selected.has(item.creative.id);
            return (
              <button key={item.creative.id} onClick={() => toggleSelect(item.creative.id)}
                style={{ position: "relative", border: sel ? "2px solid var(--color-accent)" : "2px solid var(--color-border)", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "var(--color-surface-2)", outline: "none", padding: 0, transition: "border-color 150ms" }}
              >
                <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#111" }}>
                  {item.creative.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.creative.thumbnail_url} alt={item.creative.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {item.creative.ad_type === "image" ? <ImageIcon size={18} color="rgba(255,255,255,0.15)" /> : <Film size={18} color="rgba(255,255,255,0.15)" />}
                      </div>
                  }
                  {sel && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(79,179,186,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={12} color="#0a1a1b" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-primary)", padding: "5px 7px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", margin: 0 }}>
                  {item.creative.title}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Error */}
      {saveError && <p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{saveError}</p>}

      {/* Submit */}
      <button
        type="button"
        onClick={handleAssign}
        disabled={selected.size === 0 || saving}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "11px 20px", borderRadius: 9, border: "none",
          background: selected.size > 0 && !saving ? "linear-gradient(135deg, var(--color-accent), #22d3a0)" : "var(--color-surface-2)",
          color: selected.size > 0 && !saving ? "#0a1a1b" : "var(--color-text-muted)",
          fontSize: 13, fontWeight: 700,
          cursor: selected.size > 0 && !saving ? "pointer" : "not-allowed",
          opacity: selected.size === 0 ? 0.5 : 1,
          transition: "all 200ms",
        }}
      >
        {saving
          ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Adding…</>
          : <><Check size={14} /> Add {selected.size > 0 ? `${selected.size} ` : ""}to Campaign</>
        }
      </button>
    </div>
  );
}

// ── Upload types (mirrors ManualUploadForm internals) ─────────────────────────

interface QueuedFile {
  id: string;
  file: File;
  preview: string | null;
  thumbnailBlob: Blob | null;
}

interface FileResult {
  status: "inserted" | "error";
  filename: string;
  storage_url?: string;
  error?: string;
}

const ACCEPTED = ["video/mp4", "video/quicktime", "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
const ACCEPT_STRING = ".mp4,.mov,.jpg,.jpeg,.png,.gif,.webp,.avif";
const MAX_MB = 200;

function uid() { return Math.random().toString(36).slice(2); }
function fmtBytes(b: number) {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}

// ── Upload panel ──────────────────────────────────────────────────────────────

function UploadPanel({ brandId, campaignId }: { brandId: string; campaignId?: string | null }) {
  const [queue, setQueue]         = useState<QueuedFile[]>([]);
  const [isDragging, setDragging] = useState(false);
  const [result, setResult]       = useState<FileResult[] | null>(null);
  const [uploadError, setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const valid: QueuedFile[] = [];
    for (const f of Array.from(files)) {
      if (!ACCEPTED.includes(f.type) || f.size > MAX_MB * 1024 * 1024) continue;
      const preview = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
      valid.push({ id: uid(), file: f, preview, thumbnailBlob: null });
    }
    setQueue(prev => [...prev, ...valid]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  async function handleUpload() {
    if (!queue.length || pending) return;
    setResult(null); setError(null);

    startTransition(async () => {
      // Step 1: prepare (get signed URLs)
      let prepRes: Response;
      try {
        prepRes = await fetch("/api/upload/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_name:     brandId,   // server resolves by id via brand_id field below
            brand_id:       brandId,
            platform:       "landing_page",
            campaign_id:    campaignId || undefined,
            published_date: new Date().toISOString().slice(0, 10),
            files: queue.map(q => ({ name: q.file.name, size: q.file.size, type: q.file.type })),
          }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prepData: any;
      try { prepData = await prepRes.json(); } catch { setError(`Prepare failed (${prepRes.status})`); return; }
      if (!prepRes.ok) { setError(prepData?.error ?? `Prepare failed (${prepRes.status})`); return; }

      // Step 2: PUT each file directly to Supabase Storage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadResults: any[] = new Array(queue.length).fill(null);
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prepData.uploads as any[]).map(async (u: any, i: number) => {
          try {
            const putRes = await fetch(u.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": u.contentType },
              body: queue[i].file,
            });
            uploadResults[i] = putRes.ok
              ? { ...u, ok: true, thumbnailStoragePath: null }
              : { ...u, ok: false, error: `Storage upload failed (${putRes.status})` };
          } catch (err) {
            uploadResults[i] = { ...u, ok: false, error: err instanceof Error ? err.message : "Upload failed" };
          }
        })
      );

      const successes = uploadResults.filter(r => r?.ok);
      if (!successes.length) { setError("All file uploads failed."); return; }

      // Step 3: register in DB
      try {
        const regRes = await fetch("/api/upload/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_id:       prepData.brand_id,
            brand_name:     prepData.brand_name,
            published_date: prepData.published_date,
            items: successes.map((u: { storagePath: string; contentType: string; platform: string; campaignId: string | null; originalName: string }) => ({
              storagePath:          u.storagePath,
              contentType:          u.contentType,
              platform:             "landing_page",
              campaignId:           campaignId ?? null,
              originalName:         u.originalName,
              thumbnailStoragePath: null,
            })),
          }),
        });
        const regData = await regRes.json();
        setResult(regData.results as FileResult[]);
        setQueue([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Register failed");
      }
    });
  }

  const s = { fontSize: 12, fontWeight: 600 as const, color: "var(--color-text-secondary)", textTransform: "uppercase" as const, letterSpacing: "0.06em" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "var(--color-accent)" : "var(--color-border)"}`,
          borderRadius: 12, padding: "32px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          cursor: "pointer",
          background: isDragging ? "rgba(79,179,186,0.06)" : "var(--color-surface-2)",
          transition: "all 200ms ease",
        }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(79,179,186,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UploadCloud size={20} color="var(--color-accent)" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {isDragging ? "Drop here" : "Drag & drop or browse"}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          Images or video up to {MAX_MB} MB
        </p>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPT_STRING} style={{ display: "none" }}
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={s}>{queue.length} file{queue.length !== 1 ? "s" : ""} queued</p>
            <button type="button" onClick={() => setQueue([])} style={{ fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
          </div>
          {queue.map(qf => (
            <div key={qf.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
              {qf.preview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qf.preview} alt="" style={{ width: 44, height: 32, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                : <div style={{ width: 44, height: 32, background: "var(--color-border)", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {qf.file.type.startsWith("image/") ? <ImageIcon size={14} color="var(--color-text-muted)" /> : <Film size={14} color="var(--color-text-muted)" />}
                  </div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{qf.file.name}</p>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{fmtBytes(qf.file.size)}</p>
              </div>
              <button type="button" onClick={() => setQueue(p => p.filter(q => q.id !== qf.id))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, flexShrink: 0 }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Submit */}
      <button
        id="landing-page-upload-btn"
        type="button"
        disabled={!queue.length || pending}
        onClick={handleUpload}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "11px 20px", borderRadius: 9, border: "none",
          background: queue.length && !pending ? "linear-gradient(135deg, var(--color-accent), #22d3a0)" : "var(--color-surface-2)",
          color: queue.length && !pending ? "#fff" : "var(--color-text-muted)",
          fontSize: 13, fontWeight: 700,
          cursor: queue.length && !pending ? "pointer" : "not-allowed",
          transition: "all 200ms",
        }}
      >
        {pending ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</> : <><UploadCloud size={14} /> Upload {queue.length > 0 ? `${queue.length} File${queue.length !== 1 ? "s" : ""}` : "Files"}</>}
      </button>

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14, background: "rgba(34,211,160,0.06)", border: "1px solid rgba(34,211,160,0.2)", borderRadius: 10 }}>
          {result.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {r.status === "inserted" ? <CheckCircle2 size={14} color="#22d3a0" /> : <AlertCircle size={14} color="#f43f5e" />}
              <span style={{ fontSize: 12, color: r.status === "inserted" ? "#22d3a0" : "#f43f5e", fontWeight: 600 }}>
                {r.status === "inserted" ? "Saved" : r.error}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</span>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <div style={{ display: "flex", gap: 8, padding: 12, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
          <AlertCircle size={14} color="#f43f5e" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#f43f5e" }}>{uploadError}</p>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export function LandingPageModal({ brandId, brandName, campaignId, campaignName, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>("url");

  // Body scroll lock + ESC
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "url",     label: "Capture URL",  icon: <Camera size={13} /> },
    { id: "upload",  label: "Upload File",  icon: <UploadCloud size={13} /> },
    { id: "library", label: "From Library", icon: <LibraryBig size={13} /> },
  ];

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Add landing page creative"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "48px 24px 60px", overflowY: "auto",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 600,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 20, overflow: "hidden",
          display: "flex", flexDirection: "column",
          animation: "lpModalIn 240ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "18px 22px", borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(79,179,186,0.1)", border: "1px solid rgba(79,179,186,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Globe size={15} color="var(--color-accent)" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
                Add Landing Page
              </p>
              {(brandName || campaignName) && (
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {[brandName, campaignName].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose} aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--color-text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ padding: "16px 22px 0", display: "flex", gap: 4, background: "var(--color-surface)" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                id={`lp-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: "8px 8px 0 0",
                  border: active ? "1px solid var(--color-border)" : "1px solid transparent",
                  borderBottom: active ? "1px solid var(--color-surface)" : "1px solid var(--color-border)",
                  background: active ? "var(--color-surface)" : "transparent",
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
                  cursor: "pointer", marginBottom: -1,
                  transition: "all 150ms ease",
                }}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
          <div style={{ flex: 1, borderBottom: "1px solid var(--color-border)" }} />
        </div>

        {/* Panel content */}
        <div style={{ padding: 22, animation: "fadeInUp 0.18s ease both" }} key={tab}>
          {tab === "url" && (
            <ScrapeForm
              brandId={brandId}
              brandName={brandName}
              onSuccess={onSuccess}
            />
          )}
          {tab === "upload" && (
            <UploadPanel
              brandId={brandId}
              campaignId={campaignId}
            />
          )}
          {tab === "library" && (
            <LibraryPanel
              brandId={brandId}
              campaignId={campaignId}
              onSuccess={onSuccess}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes lpModalIn {
          from { opacity: 0; transform: scale(0.97) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
