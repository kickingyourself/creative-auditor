"use client";

/**
 * components/YouTubeModal.tsx
 * Three tabs:
 *   1. YouTube URL  — single video + channel sync (YouTubeIngestForm)
 *   2. Upload File  — drag-drop pre-scoped to platform=youtube
 */

import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  X, PlayCircle, UploadCloud,
  Loader2, CheckCircle2, AlertCircle,
  Film, Image as ImageIcon, LibraryBig, Search, Check,
} from "lucide-react";
import { YouTubeIngestForm } from "@/components/YouTubeIngestForm";
import type { Creative } from "@/types";

// ── Upload panel (identical pattern to LandingPageModal) ──────────────────────

const ACCENT_YT = "#ff4444";

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
      .then(d => {
        const all = (d.creatives ?? []) as { creative: Creative; brandLogoUrl: string | null }[];
        setItems(all.filter(i => i.creative.platform === "youtube"));
        setLoading(false);
      })
      .catch(() => { setFetchError("Failed to load library."); setLoading(false); });
  }, [brandId, campaignId]);

  const filtered = items.filter(i => !search || i.creative.title.toLowerCase().includes(search.toLowerCase()));

  function toggleSelect(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleAssign() {
    if (selected.size === 0 || saving || !campaignId) return;
    setSaving(true); setSaveError(null);
    try {
      const results = await Promise.all(
        Array.from(selected).map(cid =>
          fetch(`/api/creatives/${cid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign_id: campaignId }) }).then(r => r.json())
        )
      );
      if (results.some(r => !r.updated)) { setSaveError("Some creatives could not be assigned."); }
      else { setSaved(true); onSuccess?.(); }
    } catch { setSaveError("Network error — please try again."); }
    finally { setSaving(false); }
  }

  if (!campaignId) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
      <LibraryBig size={28} color="var(--color-text-muted)" style={{ opacity: 0.4 }} />
      <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Save the campaign first to assign library creatives.</p>
    </div>
  );

  if (saved) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${ACCENT_YT}22`, border: `1px solid ${ACCENT_YT}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle2 size={22} color={ACCENT_YT} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>Added to campaign!</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ position: "relative" }}>
        <Search size={12} color="var(--color-text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input type="text" placeholder="Search creatives…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12, color: "var(--color-text-primary)", outline: "none" }}
        />
      </div>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 8 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: ACCENT_YT }} />
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Loading library…</span>
        </div>
      ) : fetchError ? (
        <div style={{ display: "flex", gap: 8, padding: 12, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
          <AlertCircle size={13} color="#f43f5e" /><p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{fetchError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 24px", border: "1px dashed var(--color-border)", borderRadius: 10 }}>
          <LibraryBig size={24} color="var(--color-text-muted)" style={{ margin: "0 auto 10px", opacity: 0.35 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>{items.length === 0 ? "No YouTube creatives in library" : "No results"}</p>
          <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{items.length === 0 ? "Ingest YouTube videos for this brand first." : "Try a different search."}</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
          {filtered.map(item => {
            const sel = selected.has(item.creative.id);
            return (
              <button key={item.creative.id} onClick={() => toggleSelect(item.creative.id)}
                style={{ position: "relative", border: sel ? `2px solid ${ACCENT_YT}` : "2px solid var(--color-border)", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "var(--color-surface-2)", outline: "none", padding: 0, transition: "border-color 150ms" }}
              >
                <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#111" }}>
                  {item.creative.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.creative.thumbnail_url} alt={item.creative.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Film size={18} color="rgba(255,255,255,0.15)" /></div>
                  }
                  {sel && (
                    <div style={{ position: "absolute", inset: 0, background: `${ACCENT_YT}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: ACCENT_YT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </div>
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-primary)", padding: "5px 7px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", margin: 0 }}>{item.creative.title}</p>
              </button>
            );
          })}
        </div>
      )}
      {saveError && <p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{saveError}</p>}
      <button type="button" onClick={handleAssign} disabled={selected.size === 0 || saving}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", borderRadius: 9, border: "none", background: selected.size > 0 && !saving ? `linear-gradient(135deg, ${ACCENT_YT}, #ff8800)` : "var(--color-surface-2)", color: selected.size > 0 && !saving ? "#fff" : "var(--color-text-muted)", fontSize: 13, fontWeight: 700, cursor: selected.size > 0 && !saving ? "pointer" : "not-allowed", opacity: selected.size === 0 ? 0.5 : 1, transition: "all 200ms" }}
      >
        {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Adding…</> : <><Check size={14} /> Add {selected.size > 0 ? `${selected.size} ` : ""}to Campaign</>}
      </button>
    </div>
  );
}

interface QueuedFile { id: string; file: File; preview: string | null; }

const ACCEPTED = ["video/mp4","video/quicktime","image/jpeg","image/png","image/gif","image/webp","image/avif"];
const ACCEPT_STRING = ".mp4,.mov,.jpg,.jpeg,.png,.gif,.webp,.avif";
const MAX_MB = 200;
function uid() { return Math.random().toString(36).slice(2); }
function fmtBytes(b: number) { return b >= 1048576 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`; }

function UploadPanel({ brandId, campaignId }: { brandId: string; campaignId?: string | null }) {
  const [queue, setQueue]           = useState<QueuedFile[]>([]);
  const [isDragging, setDragging]   = useState(false);
  const [results, setResults]       = useState<{ status: string; filename: string; error?: string }[] | null>(null);
  const [uploadError, setError]     = useState<string | null>(null);
  const [pending, startTransition]  = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const valid: QueuedFile[] = [];
    for (const f of Array.from(files)) {
      if (!ACCEPTED.includes(f.type) || f.size > MAX_MB * 1024 * 1024) continue;
      valid.push({ id: uid(), file: f, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null });
    }
    setQueue(p => [...p, ...valid]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files);
  }, []);

  function handleUpload() {
    if (!queue.length || pending) return;
    setResults(null); setError(null);
    startTransition(async () => {
      let prepRes: Response;
      try {
        prepRes = await fetch("/api/upload/prepare", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_id: brandId, platform: "youtube",
            campaign_id: campaignId || undefined,
            published_date: new Date().toISOString().slice(0, 10),
            files: queue.map(q => ({ name: q.file.name, size: q.file.size, type: q.file.type })),
          }),
        });
      } catch (err) { setError(err instanceof Error ? err.message : "Network error"); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prepData: any;
      try { prepData = await prepRes.json(); } catch { setError(`Prepare failed (${prepRes.status})`); return; }
      if (!prepRes.ok) { setError(prepData?.error ?? "Prepare failed"); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadResults: any[] = new Array(queue.length).fill(null);
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prepData.uploads as any[]).map(async (u: any, i: number) => {
          try {
            const r = await fetch(u.signedUrl, { method: "PUT", headers: { "Content-Type": u.contentType }, body: queue[i].file });
            uploadResults[i] = r.ok ? { ...u, ok: true } : { ...u, ok: false, error: `Upload failed (${r.status})` };
          } catch (err) { uploadResults[i] = { ...u, ok: false, error: err instanceof Error ? err.message : "Failed" }; }
        })
      );

      const successes = uploadResults.filter(r => r?.ok);
      if (!successes.length) { setError("All uploads failed."); return; }

      try {
        const reg = await fetch("/api/upload/register", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_id: prepData.brand_id, brand_name: prepData.brand_name,
            published_date: prepData.published_date,
            items: successes.map((u: { storagePath: string; contentType: string; originalName: string }) => ({
              storagePath: u.storagePath, contentType: u.contentType,
              platform: "youtube", campaignId: campaignId ?? null,
              originalName: u.originalName, thumbnailStoragePath: null,
            })),
          }),
        });
        const regData = await reg.json();
        setResults(regData.results);
        setQueue([]);
      } catch (err) { setError(err instanceof Error ? err.message : "Register failed"); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${isDragging ? "var(--color-accent)" : "var(--color-border)"}`, borderRadius: 12, padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "pointer", background: isDragging ? "rgba(255,68,68,0.04)" : "var(--color-surface-2)", transition: "all 200ms" }}
      >
        <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,68,68,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UploadCloud size={20} color="#ff4444" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>{isDragging ? "Drop here" : "Drag & drop or browse"}</p>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>MP4, MOV, JPG, PNG — up to {MAX_MB} MB</p>
        <input ref={fileRef} type="file" multiple accept={ACCEPT_STRING} style={{ display: "none" }}
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {queue.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{queue.length} queued</span>
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
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" disabled={!queue.length || pending} onClick={handleUpload}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 20px", borderRadius: 9, border: "none", background: queue.length && !pending ? "linear-gradient(135deg, #ff4444, #ff8800)" : "var(--color-surface-2)", color: queue.length && !pending ? "#fff" : "var(--color-text-muted)", fontSize: 13, fontWeight: 700, cursor: queue.length && !pending ? "pointer" : "not-allowed", transition: "all 200ms" }}>
        {pending ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</> : <><UploadCloud size={14} /> Upload {queue.length > 0 ? `${queue.length} File${queue.length !== 1 ? "s" : ""}` : "Files"}</>}
      </button>

      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14, background: "rgba(34,211,160,0.06)", border: "1px solid rgba(34,211,160,0.2)", borderRadius: 10 }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {r.status === "inserted" ? <CheckCircle2 size={14} color="#22d3a0" /> : <AlertCircle size={14} color="#f43f5e" />}
              <span style={{ fontSize: 12, color: r.status === "inserted" ? "#22d3a0" : "#f43f5e", fontWeight: 600 }}>{r.status === "inserted" ? "Saved" : r.error}</span>
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

type Tab = "ingest" | "upload" | "library";

interface Props {
  brandId: string;
  brandName?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function YouTubeModal({ brandId, brandName, campaignId, campaignName, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>("ingest");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "ingest",  label: "YouTube URL",  icon: <PlayCircle size={13} /> },
    { id: "upload",  label: "Upload File",  icon: <UploadCloud size={13} /> },
    { id: "library", label: "From Library", icon: <LibraryBig size={13} /> },
  ];

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Add YouTube creative"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "48px 24px 60px", overflowY: "auto" }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 640, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", animation: "ytModalIn 240ms cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, zIndex: 10, background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,68,68,0.10)", border: "1px solid rgba(255,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <PlayCircle size={15} color="#ff4444" />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.2 }}>Add YouTube Creative</p>
              {(brandName || campaignName) && (
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{[brandName, campaignName].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--color-text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "16px 22px 0", display: "flex", gap: 4 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} id={`yt-tab-${t.id}`} onClick={() => setTab(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: "8px 8px 0 0", border: active ? "1px solid var(--color-border)" : "1px solid transparent", borderBottom: active ? "1px solid var(--color-surface)" : "1px solid var(--color-border)", background: active ? "var(--color-surface)" : "transparent", fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "#ff4444" : "var(--color-text-secondary)", cursor: "pointer", marginBottom: -1, transition: "all 150ms ease" }}
              >
                {t.icon} {t.label}
              </button>
            );
          })}
          <div style={{ flex: 1, borderBottom: "1px solid var(--color-border)" }} />
        </div>

        {/* Content */}
        <div style={{ padding: 22, animation: "fadeInUp 0.18s ease both" }} key={tab}>
          {tab === "ingest"  && <YouTubeIngestForm brandId={brandId} brandName={brandName} campaignId={campaignId} campaignName={campaignName ?? undefined} />}
          {tab === "upload"  && <UploadPanel brandId={brandId} campaignId={campaignId} />}
          {tab === "library" && <LibraryPanel brandId={brandId} campaignId={campaignId} onSuccess={onSuccess} />}
        </div>
      </div>

      <style>{`
        @keyframes ytModalIn { from { opacity:0; transform:scale(0.97) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes fadeInUp  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>,
    document.body
  );
}
