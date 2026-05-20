"use client";

/**
 * components/ProgrammaticModal.tsx
 *
 * Upload modal for programmatic display creatives.
 * Supports: HTML5 (.zip, .html), JPG, PNG, GIF — all banner and social sizes.
 * Features: bulk upload, per-file size tagging, From Library tab.
 */

import { useEffect, useState, useRef, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  X, UploadCloud, Loader2, CheckCircle2, AlertCircle,
  Film, Image as ImageIcon, LibraryBig, Search, Check,
  Code2, Tag, ChevronDown,
} from "lucide-react";
import type { Creative } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT     = "#8b5cf6"; // violet
const ACCENT_BG  = "rgba(139,92,246,0.12)";

const ACCEPTED_MIME = [
  "image/jpeg","image/png","image/gif","image/webp",
  "application/zip","application/x-zip-compressed","application/x-zip",
  "text/html",
];
const ACCEPT_STRING = ".jpg,.jpeg,.png,.gif,.webp,.zip,.html,.htm";
const MAX_MB = 50;

// IAB standard banner sizes + common social sizes
const SIZE_GROUPS = {
  "IAB Leaderboard":   ["728×90","970×90","970×250"],
  "IAB Rectangle":     ["300×250","336×280","300×600"],
  "IAB Half Page":     ["300×600","160×600"],
  "IAB Mobile":        ["320×50","320×100","300×50"],
  "Social — Feed":     ["1200×628","1080×1080","1080×1350"],
  "Social — Story":    ["1080×1920","1080×1920"],
  "Custom":            ["Custom"],
} as const;

const ALL_SIZES = Array.from(
  new Set(Object.values(SIZE_GROUPS).flat())
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }
function fmtBytes(b: number) {
  return b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
}
function fileIcon(type: string) {
  if (type === "text/html" || type.includes("zip")) return <Code2 size={14} color={ACCENT} />;
  if (type.startsWith("image/gif"))                  return <Film  size={14} color="var(--color-text-muted)" />;
  return <ImageIcon size={14} color="var(--color-text-muted)" />;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueuedFile {
  id: string;
  file: File;
  preview: string | null;
  sizes: string[];        // selected size tags
  customSize: string;     // filled when "Custom" is selected
  tagOpen: boolean;       // size picker popover open
  autoDetected: boolean;  // true when size was detected automatically
}

interface UploadResult { status: string; filename: string; error?: string; }

// ── Dimension detection ───────────────────────────────────────────────────────

/** Detect pixel dimensions from a raster image file via the browser Image API. */
function detectImageDimensions(file: File): Promise<string | null> {
  return new Promise(resolve => {
    if (!file.type.startsWith("image/")) { resolve(null); return; }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(`${img.naturalWidth}×${img.naturalHeight}`); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** Parse a WxH or W×H dimension from a filename (e.g. banner_300x250.zip → '300×250'). */
function detectDimensionsFromFilename(name: string): string | null {
  const m = name.match(/(\d{2,4})[x×_\-](\d{2,4})/i);
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  // Sanity check — ignore obvious false-positives like dates (2024×05)
  if (w < 50 || h < 50 || w > 5000 || h > 5000) return null;
  return `${w}×${h}`;
}

/**
 * Given a raw WxH string, return { sizes, customSize } for the QueuedFile.
 * If the dimension matches a known size label it's stored as-is;
 * otherwise it's stored as a Custom entry.
 */
function resolveDimension(raw: string): { sizes: string[]; customSize: string } {
  if (ALL_SIZES.includes(raw as (typeof ALL_SIZES)[number])) {
    return { sizes: [raw], customSize: "" };
  }
  return { sizes: ["Custom"], customSize: raw };
}

// ── Size tag picker (per-file popover) ────────────────────────────────────────

function SizePicker({
  selected, customSize, onChange, onCustomChange, onClose,
}: {
  selected: string[];
  customSize: string;
  onChange: (sizes: string[]) => void;
  onCustomChange: (v: string) => void;
  onClose: () => void;
}) {
  function toggle(s: string) {
    onChange(selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s]);
  }
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
        background: "var(--color-surface)", border: "1px solid var(--color-border)",
        borderRadius: 12, padding: "14px 14px 10px", width: 240,
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Select sizes</p>
      {Object.entries(SIZE_GROUPS).map(([group, sizes]) => (
        <div key={group}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{group}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {sizes.map(s => (
              <button key={s} onClick={() => toggle(s)}
                style={{
                  fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
                  border: selected.includes(s) ? `1px solid ${ACCENT}` : "1px solid var(--color-border)",
                  background: selected.includes(s) ? ACCENT_BG : "transparent",
                  color: selected.includes(s) ? ACCENT : "var(--color-text-secondary)",
                  cursor: "pointer",
                }}
              >{s}</button>
            ))}
          </div>
        </div>
      ))}
      {selected.includes("Custom") && (
        <input
          type="text" placeholder="e.g. 640×480"
          value={customSize} onChange={e => onCustomChange(e.target.value)}
          style={{ fontSize: 11, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-primary)", outline: "none", width: "100%", boxSizing: "border-box" }}
        />
      )}
      <button onClick={onClose}
        style={{ fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", alignSelf: "flex-end" }}
      >Done</button>
    </div>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────────────

function UploadPanel({ brandId, brandName, campaignId }: {
  brandId: string; brandName?: string; campaignId?: string | null;
}) {
  const [queue, setQueue]          = useState<QueuedFile[]>([]);
  const [isDragging, setDragging]  = useState(false);
  const [results, setResults]      = useState<UploadResult[] | null>(null);
  const [uploadError, setError]    = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    const valid: QueuedFile[] = [];
    for (const f of Array.from(files)) {
      const normType = f.type || (f.name.endsWith(".zip") ? "application/zip" : f.name.endsWith(".html") || f.name.endsWith(".htm") ? "text/html" : "");
      if (!ACCEPTED_MIME.includes(normType) || f.size > MAX_MB * 1024 * 1024) continue;
      const preview = f.type.startsWith("image/") && f.type !== "image/gif"
        ? URL.createObjectURL(f) : null;

      // Start with no sizes — detection runs below
      valid.push({ id: uid(), file: f, preview, sizes: [], customSize: "", tagOpen: false, autoDetected: false });
    }
    if (!valid.length) return;

    // Auto-detect dimensions for each file
    const detected = await Promise.all(valid.map(async qf => {
      const isImage = qf.file.type.startsWith("image/");
      const raw = isImage
        ? await detectImageDimensions(qf.file)
        : detectDimensionsFromFilename(qf.file.name);
      if (!raw) return qf;
      const { sizes, customSize } = resolveDimension(raw);
      return { ...qf, sizes, customSize, autoDetected: true };
    }));

    setQueue(p => [...p, ...detected]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateItem(id: string, patch: Partial<QueuedFile>) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }

  function sizeLabel(item: QueuedFile) {
    if (item.sizes.length === 0) return "Tag size";
    const labels = item.sizes.map(s => s === "Custom" && item.customSize ? item.customSize : s);
    return labels.join(", ");
  }

  function effectiveSize(item: QueuedFile): string {
    if (item.sizes.length === 0) return "";
    return item.sizes.map(s => s === "Custom" && item.customSize ? item.customSize : s).join(", ");
  }

  function handleUpload() {
    if (!queue.length || pending) return;
    setResults(null); setError(null);
    startTransition(async () => {
      let prepRes: Response;
      try {
        prepRes = await fetch("/api/upload/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_id:       brandId,
            brand_name:     brandName ?? brandId,
            platform:       "programmatic",
            campaign_id:    campaignId || undefined,
            published_date: new Date().toISOString().slice(0, 10),
            files: queue.map(q => ({
              name: q.file.name,
              size: q.file.size,
              type: q.file.type || (q.file.name.endsWith(".zip") ? "application/zip" : "text/html"),
            })),
          }),
        });
      } catch (err) { setError(err instanceof Error ? err.message : "Network error"); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prepData: any;
      try { prepData = await prepRes.json(); }
      catch { setError(`Prepare failed (${prepRes.status})`); return; }
      if (!prepRes.ok) { setError(prepData?.error ?? "Prepare failed"); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadResults: any[] = new Array(queue.length).fill(null);
      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prepData.uploads as any[]).map(async (u: any, i: number) => {
          const ct = queue[i].file.type || (queue[i].file.name.endsWith(".zip") ? "application/zip" : "text/html");
          try {
            const r = await fetch(u.signedUrl, { method: "PUT", headers: { "Content-Type": ct }, body: queue[i].file });
            uploadResults[i] = r.ok ? { ...u, ok: true } : { ...u, ok: false, error: `Upload failed (${r.status})` };
          } catch (err) { uploadResults[i] = { ...u, ok: false, error: err instanceof Error ? err.message : "Failed" }; }
        })
      );

      const successes = uploadResults.filter(r => r?.ok);
      if (!successes.length) { setError("All uploads failed."); return; }

      try {
        const reg = await fetch("/api/upload/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_id:       prepData.brand_id,
            brand_name:     prepData.brand_name,
            published_date: prepData.published_date,
            items: successes.map((u: { storagePath: string; contentType: string; originalName: string }, i: number) => {
              const qf = queue[i];
              const sizeTags = qf
                ? qf.sizes.map(s => s === "Custom" && qf.customSize ? qf.customSize : s)
                : [];
              return {
                storagePath:          u.storagePath,
                contentType:          u.contentType,
                platform:             "programmatic",
                campaignId:           campaignId ?? null,
                originalName:         u.originalName,
                thumbnailStoragePath: null,
                tags:                 sizeTags,
              };
            }),
          }),
        });
        const regData = await reg.json();
        setResults(regData.results as UploadResult[]);
        setQueue([]);
      } catch (err) { setError(err instanceof Error ? err.message : "Register failed"); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)} onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? ACCENT : "var(--color-border)"}`,
          borderRadius: 12, padding: "28px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          cursor: "pointer", background: isDragging ? ACCENT_BG : "var(--color-surface-2)",
          transition: "all 200ms",
        }}
      >
        <div style={{ width: 46, height: 46, borderRadius: 12, background: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UploadCloud size={22} color={ACCENT} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {isDragging ? "Drop files here" : "Drag & drop or browse"}
        </p>
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "center" }}>
          HTML5 (.zip / .html), JPG, PNG, GIF — up to {MAX_MB} MB each
        </p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {["HTML5","JPG","PNG","GIF"].map(t => (
            <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, border: `1px solid ${ACCENT}50`, color: ACCENT, background: ACCENT_BG }}>{t}</span>
          ))}
        </div>
        <input ref={fileRef} type="file" multiple accept={ACCEPT_STRING} style={{ display: "none" }}
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {queue.length} file{queue.length !== 1 ? "s" : ""} queued
            </span>
            <button type="button" onClick={() => setQueue([])}
              style={{ fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >Clear all</button>
          </div>

          {queue.map(qf => (
            <div key={qf.id}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10 }}
            >
              {/* Thumbnail / icon */}
              {qf.preview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qf.preview} alt="" style={{ width: 44, height: 32, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />
                : <div style={{ width: 44, height: 32, background: "var(--color-border)", borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {fileIcon(qf.file.type || (qf.file.name.endsWith(".zip") ? "application/zip" : "text/html"))}
                  </div>
              }

              {/* Name + size */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                  {qf.file.name}
                </p>

                {/* Size row: detected badge OR tag button */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  {qf.autoDetected && qf.sizes.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(34,211,160,0.15)", color: "#22d3a0", border: "1px solid rgba(34,211,160,0.3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Auto
                    </span>
                  )}
                  <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: 0 }}>
                    {qf.sizes.length > 0 ? effectiveSize(qf) : fmtBytes(qf.file.size)}
                  </p>
                  {qf.sizes.length === 0 && (
                    <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: 0 }}>{/* byte size shown above */}</p>
                  )}
                </div>
                {qf.sizes.length === 0 && (
                  <p style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 6 }}>{fmtBytes(qf.file.size)}</p>
                )}

                {/* Size tag button + popover */}
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button type="button"
                    onClick={() => updateItem(qf.id, { tagOpen: !qf.tagOpen })}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                      border: qf.sizes.length > 0 ? `1px solid ${ACCENT}` : "1px solid var(--color-border)",
                      background: qf.sizes.length > 0 ? ACCENT_BG : "transparent",
                      color: qf.sizes.length > 0 ? ACCENT : "var(--color-text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <Tag size={10} />
                    {qf.autoDetected && qf.sizes.length > 0 ? "Edit" : sizeLabel(qf)}
                    <ChevronDown size={9} />
                  </button>

                  {qf.tagOpen && (
                    <SizePicker
                      selected={qf.sizes}
                      customSize={qf.customSize}
                      onChange={sizes => updateItem(qf.id, { sizes, autoDetected: false })}
                      onCustomChange={customSize => updateItem(qf.id, { customSize })}
                      onClose={() => updateItem(qf.id, { tagOpen: false })}
                    />
                  )}
                </div>
              </div>

              {/* Remove */}
              <button type="button" onClick={() => setQueue(p => p.filter(q => q.id !== qf.id))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 2, flexShrink: 0, marginTop: 2 }}
              ><X size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div style={{ display: "flex", gap: 8, padding: 12, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
          <AlertCircle size={14} color="#f43f5e" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{uploadError}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 14, background: "rgba(34,211,160,0.06)", border: "1px solid rgba(34,211,160,0.2)", borderRadius: 10 }}>
          {results.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {r.status === "inserted" ? <CheckCircle2 size={14} color="#22d3a0" /> : <AlertCircle size={14} color="#f43f5e" />}
              <span style={{ fontSize: 12, fontWeight: 600, color: r.status === "inserted" ? "#22d3a0" : "#f43f5e" }}>
                {r.status === "inserted" ? "Saved" : r.error}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</span>
            </div>
          ))}
        </div>
      )}

      {/* Submit */}
      <button type="button" disabled={!queue.length || pending} onClick={handleUpload}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "12px 20px", borderRadius: 9, border: "none",
          background: queue.length && !pending ? `linear-gradient(135deg, ${ACCENT}, #6d28d9)` : "var(--color-surface-2)",
          color: queue.length && !pending ? "#fff" : "var(--color-text-muted)",
          fontSize: 13, fontWeight: 700,
          cursor: queue.length && !pending ? "pointer" : "not-allowed",
          transition: "all 200ms",
        }}
      >
        {pending
          ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</>
          : <><UploadCloud size={14} /> Upload {queue.length > 0 ? `${queue.length} File${queue.length !== 1 ? "s" : ""}` : "Files"}</>
        }
      </button>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Library panel ─────────────────────────────────────────────────────────────

function LibraryPanel({ brandId, campaignId, onSuccess }: {
  brandId: string; campaignId?: string | null; onSuccess?: () => void;
}) {
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
        setItems(all.filter(i => i.creative.platform === "programmatic"));
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
          fetch(`/api/creatives/${cid}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaign_id: campaignId }),
          }).then(r => r.json())
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
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckCircle2 size={22} color={ACCENT} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>Added to campaign!</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ position: "relative" }}>
        <Search size={12} color="var(--color-text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input type="text" placeholder="Search programmatic creatives…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12, color: "var(--color-text-primary)", outline: "none" }}
        />
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 8 }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: ACCENT }} />
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Loading library…</span>
        </div>
      ) : fetchError ? (
        <div style={{ display: "flex", gap: 8, padding: 12, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
          <AlertCircle size={13} color="#f43f5e" /><p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{fetchError}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "36px 24px", border: "1px dashed var(--color-border)", borderRadius: 10 }}>
          <LibraryBig size={24} color="var(--color-text-muted)" style={{ margin: "0 auto 10px", opacity: 0.35 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
            {items.length === 0 ? "No programmatic creatives in library" : "No results"}
          </p>
          <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            {items.length === 0 ? "Upload HTML5 or image banners for this brand first." : "Try a different search."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
          {filtered.map(item => {
            const sel = selected.has(item.creative.id);
            return (
              <button key={item.creative.id} onClick={() => toggleSelect(item.creative.id)}
                style={{ position: "relative", border: sel ? `2px solid ${ACCENT}` : "2px solid var(--color-border)", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "var(--color-surface-2)", outline: "none", padding: 0, transition: "border-color 150ms" }}
              >
                <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#111" }}>
                  {item.creative.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.creative.thumbnail_url} alt={item.creative.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Code2 size={18} color={ACCENT} style={{ opacity: 0.4 }} /></div>
                  }
                  {sel && (
                    <div style={{ position: "absolute", inset: 0, background: `${ACCENT}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={12} color="#fff" strokeWidth={3} />
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

      {saveError && <p style={{ fontSize: 12, color: "#f43f5e", margin: 0 }}>{saveError}</p>}

      <button type="button" onClick={handleAssign} disabled={selected.size === 0 || saving}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 20px", borderRadius: 9, border: "none", background: selected.size > 0 && !saving ? `linear-gradient(135deg, ${ACCENT}, #6d28d9)` : "var(--color-surface-2)", color: selected.size > 0 && !saving ? "#fff" : "var(--color-text-muted)", fontSize: 13, fontWeight: 700, cursor: selected.size > 0 && !saving ? "pointer" : "not-allowed", opacity: selected.size === 0 ? 0.5 : 1, transition: "all 200ms" }}
      >
        {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Adding…</> : <><Check size={14} /> Add {selected.size > 0 ? `${selected.size} ` : ""}to Campaign</>}
      </button>
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

type Tab = "upload" | "library";

interface Props {
  brandId: string;
  brandName?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProgrammaticModal({ brandId, brandName, campaignId, campaignName, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>("upload");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "upload",  label: "Upload Files",  icon: <UploadCloud size={13} /> },
    { id: "library", label: "From Library",  icon: <LibraryBig size={13} /> },
  ];

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Add programmatic creative"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(12px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "48px 24px 60px", overflowY: "auto" }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 660, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", animation: "progModalIn 240ms cubic-bezier(0.34,1.56,0.64,1) both" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 22px", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, zIndex: 10, background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_BG, border: `1px solid ${ACCENT}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Code2 size={15} color={ACCENT} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.2 }}>Add Programmatic Creative</p>
              {(brandName || campaignName) && (
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{[brandName, campaignName].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--color-text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          ><X size={14} /></button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "16px 22px 0", display: "flex", gap: 4 }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} id={`prog-tab-${t.id}`} onClick={() => setTab(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: "8px 8px 0 0", border: active ? "1px solid var(--color-border)" : "1px solid transparent", borderBottom: active ? "1px solid var(--color-surface)" : "1px solid var(--color-border)", background: active ? "var(--color-surface)" : "transparent", fontSize: 12, fontWeight: active ? 700 : 500, color: active ? ACCENT : "var(--color-text-secondary)", cursor: "pointer", marginBottom: -1, transition: "all 150ms ease" }}
              >{t.icon} {t.label}</button>
            );
          })}
          <div style={{ flex: 1, borderBottom: "1px solid var(--color-border)" }} />
        </div>

        {/* Content */}
        <div style={{ padding: 22, animation: "fadeInUp 0.18s ease both" }} key={tab}>
          {tab === "upload"  && <UploadPanel brandId={brandId} brandName={brandName} campaignId={campaignId} />}
          {tab === "library" && <LibraryPanel brandId={brandId} campaignId={campaignId} onSuccess={onSuccess} />}
        </div>
      </div>

      <style>{`
        @keyframes progModalIn { from { opacity:0; transform:scale(0.97) translateY(16px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes fadeInUp    { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>,
    document.body
  );
}
