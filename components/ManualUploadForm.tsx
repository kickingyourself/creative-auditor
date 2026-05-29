"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import {
  UploadCloud, X, Film, Image, CheckCircle2, AlertCircle,
  Loader2, Plus, Building2, Calendar, Tag,
} from "lucide-react";
import { captureVideoFrame } from "@/lib/captureVideoFrame";


// ── Types ─────────────────────────────────────────────────────────────────────

interface QueuedFile {
  id: string;
  file: File;
  preview: string | null;      // object URL — images: the file itself; videos: canvas-captured frame
  thumbnailBlob: Blob | null;  // JPEG blob to upload alongside the video
}

interface FileResult {
  status: "inserted" | "error";
  filename: string;
  storage_url?: string;
  creative_id?: string;
  error?: string;
}

interface UploadSummary {
  inserted: number;
  errors: number;
  brand_id: string;
  brand_name: string;
  published_date: string;
}

interface UploadResponse {
  summary: UploadSummary;
  results: FileResult[];
}

interface BrandSuggestion { id: string; name: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED = ["video/mp4", "video/quicktime", "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
const ACCEPT_STRING = ".mp4,.mov,.jpg,.jpeg,.png,.gif,.webp,.avif";
const MAX_MB = 200;

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }
function fmtBytes(b: number) {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}
function isImage(mime: string) { return mime.startsWith("image/"); }
function isVideoFile(mime: string) { return mime.startsWith("video/"); }


// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
      {children}
    </label>
  );
}

function Input({ id, value, onChange, placeholder, type = "text", disabled, min, max }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; disabled?: boolean; min?: string; max?: string;
}) {
  return (
    <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} disabled={disabled} autoComplete="off" min={min} max={max}
      style={{ width: "100%", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px", color: "var(--color-text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", opacity: disabled ? 0.5 : 1 }} />
  );
}

// ── Brand combobox ────────────────────────────────────────────────────────────

function BrandCombobox({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function search(q: string) {
    if (q.length < 1) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/brands/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json() as BrandSuggestion[];
        setSuggestions(data);
        setOpen(data.length > 0);
      }
    } finally { setLoading(false); }
  }

  function handleChange(v: string) {
    onChange(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(v), 250);
  }

  function pick(name: string) { onChange(name); setOpen(false); setSuggestions([]); }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <Building2 size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
        <input id="upload-brand-name" type="text" value={value} onChange={e => handleChange(e.target.value)}
          placeholder="Nike, Chipotle, …" disabled={disabled} autoComplete="off"
          onFocus={() => value.length > 0 && suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{ width: "100%", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px 10px 34px", color: "var(--color-text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", opacity: disabled ? 0.5 : 1 }} />
        {loading && <Loader2 size={13} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", animation: "spin 1s linear infinite", color: "var(--color-text-muted)" }} />}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, zIndex: 100, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {suggestions.map(s => (
            <button key={s.id} type="button" onMouseDown={() => pick(s.name)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)", textAlign: "left" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
              <Building2 size={13} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
              {s.name}
            </button>
          ))}
          {value && !suggestions.find(s => s.name.toLowerCase() === value.toLowerCase()) && (
            <button type="button" onMouseDown={() => pick(value)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "none", border: "none", borderTop: "1px solid var(--color-border)", cursor: "pointer", fontSize: 13, color: "var(--color-accent)", textAlign: "left" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
              <Plus size={13} style={{ flexShrink: 0 }} />
              Create "{value}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── File queue item ───────────────────────────────────────────────────────────

function FileItem({ qf, onRemove, result }: { qf: QueuedFile; onRemove: () => void; result?: FileResult }) {
  const img = isImage(qf.file.type);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-surface-2)", border: `1px solid ${result?.status === "error" ? "rgba(244,63,94,0.3)" : result?.status === "inserted" ? "rgba(34,211,160,0.2)" : "var(--color-border)"}`, borderRadius: 8, animation: "fadeInUp 0.2s ease both" }}>
      {qf.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qf.preview} alt="" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
      ) : (
        <div style={{ width: 48, height: 36, background: "var(--color-border)", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {img ? <Image size={16} color="var(--color-text-muted)" /> : <Film size={16} color="var(--color-text-muted)" />}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{qf.file.name}</p>
        <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
          {fmtBytes(qf.file.size)} · {img ? "Image" : "Video"}
          {result?.status === "error" && <span style={{ color: "#f43f5e" }}> · {result.error}</span>}
          {result?.status === "inserted" && <span style={{ color: "#22d3a0" }}> · Saved</span>}
        </p>
      </div>
      {!result && (
        <button type="button" onClick={onRemove} title="Remove"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, flexShrink: 0 }}>
          <X size={14} />
        </button>
      )}
      {result?.status === "inserted" && <CheckCircle2 size={16} color="#22d3a0" style={{ flexShrink: 0 }} />}
      {result?.status === "error" && <AlertCircle size={16} color="#f43f5e" style={{ flexShrink: 0 }} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ManualUploadForm() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [brandName, setBrandName] = useState("");
  const [brandWebsite, setBrandWebsite] = useState("");
  const [publishedDate, setPublishedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [campaignId, setCampaignId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [response, setResponse] = useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | File[]) {
    const valid: QueuedFile[] = [];
    for (const f of Array.from(incoming)) {
      if (!ACCEPTED.includes(f.type)) continue;
      if (f.size > MAX_MB * 1024 * 1024) continue;
      const preview = isImage(f.type) ? URL.createObjectURL(f) : null;
      const id = uid();
      valid.push({ id, file: f, preview, thumbnailBlob: null });

      // For videos: generate thumbnail async and update the queue item when ready
      if (isVideoFile(f.type)) {
        captureVideoFrame(f, 1).then((blob) => {
          if (!blob) return;
          const previewUrl = URL.createObjectURL(blob);
          setQueue(prev => prev.map(q =>
            q.id === id ? { ...q, preview: previewUrl, thumbnailBlob: blob } : q
          ));
        });
      }
    }
    setQueue(prev => [...prev, ...valid]);
  }

  function removeFile(id: string) {
    setQueue(prev => {
      const item = prev.find(q => q.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return prev.filter(q => q.id !== id);
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim() || !publishedDate || queue.length === 0) return;
    setResponse(null); setUploadError(null);

    startTransition(async () => {
      // ── Step 1: Prepare ───────────────────────────────────────────────────
      // Send only file metadata (name/size/type) to get signed upload URLs.
      // No file bytes pass through Vercel, so no 4.5 MB limit applies here.
      let prepareRes: Response;
      try {
        prepareRes = await fetch("/api/upload/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand_name:     brandName.trim(),
            brand_website:  brandWebsite.trim(),
            published_date: publishedDate,
            platform,
            campaign_id:    campaignId.trim() || undefined,
            files: queue.map(q => ({ name: q.file.name, size: q.file.size, type: q.file.type })),
          }),
        });
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Network error during prepare.");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prepareData: any;
      try {
        prepareData = await prepareRes.json();
      } catch {
        setUploadError(`Server error during prepare (HTTP ${prepareRes.status}).`);
        return;
      }
      if (!prepareRes.ok) {
        setUploadError(prepareData?.detail ?? prepareData?.error ?? `Prepare failed (HTTP ${prepareRes.status}).`);
        return;
      }

      // ── Step 2: Upload each file directly to Supabase Storage ─────────────
      // PUT goes Browser → Supabase directly — completely bypasses Vercel.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadResults: any[] = new Array(queue.length).fill(null);

      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prepareData.uploads as any[]).map(async (u: any, i: number) => {
          const queuedFile = queue[i];
          try {
            // Upload main file
            const putRes = await fetch(u.signedUrl, {
              method: "PUT",
              headers: { "Content-Type": u.contentType },
              body: queuedFile.file,
            });
            if (!putRes.ok) {
              let reason = `HTTP ${putRes.status}`;
              try { const rb = await putRes.json(); reason = rb?.message ?? rb?.error ?? reason; } catch { /* ignore */ }
              if (putRes.status === 413) reason = "File too large for storage bucket (limit: 500 MB)";
              uploadResults[i] = { ...u, ok: false, error: reason };
              return;
            }

            // Upload thumbnail (for videos — generated client-side before submit)
            let thumbnailStoragePath: string | null = null;
            if (u.thumbnailSignedUrl && queuedFile.thumbnailBlob) {
              const thumbPut = await fetch(u.thumbnailSignedUrl, {
                method: "PUT",
                headers: { "Content-Type": "image/jpeg" },
                body: queuedFile.thumbnailBlob,
              });
              if (thumbPut.ok) thumbnailStoragePath = u.thumbnailStoragePath;
            }

            uploadResults[i] = { ...u, ok: true, thumbnailStoragePath, fileSizeBytes: queuedFile.file.size };
          } catch (err) {
            uploadResults[i] = { ...u, ok: false, error: err instanceof Error ? err.message : "Network error during upload." };
          }
        })
      );

      const successfulUploads = uploadResults.filter(r => r?.ok);
      const failedUploads     = uploadResults.filter(r => !r?.ok);

      // ── Step 3: Register successful uploads in the DB ──────────────────────
      let json: UploadResponse | null = null;
      if (successfulUploads.length > 0) {
        try {
          const regRes = await fetch("/api/upload/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ingest_job_id:  prepareData.ingest_job_id ?? null,
              brand_id:       prepareData.brand_id,
              brand_name:     prepareData.brand_name,
              published_date: prepareData.published_date,
              items: successfulUploads.map((u: { storagePath: string; contentType: string; platform: string; campaignId: string | null; originalName: string; thumbnailStoragePath: string | null; fileSizeBytes?: number | null }) => ({
                storagePath:          u.storagePath,
                contentType:          u.contentType,
                platform:             u.platform,
                campaignId:           u.campaignId,
                originalName:         u.originalName,
                thumbnailStoragePath: u.thumbnailStoragePath ?? null,
                fileSizeBytes:        u.fileSizeBytes ?? null,
              })),
            }),
          });
          json = await regRes.json() as UploadResponse;
        } catch (err) {
          setUploadError(err instanceof Error ? err.message : "Network error during register.");
          return;
        }
      }

      // Merge storage-upload results with DB-register results
      const mergedResults: FileResult[] = uploadResults.map((u) =>
        u?.ok
          ? (json?.results.find((r: FileResult) => r.filename === u.originalName) ?? { status: "error" as const, filename: u?.originalName ?? "?", error: "DB registration missing" })
          : { status: "error" as const, filename: u?.originalName ?? "?", error: u?.error }
      );
      const mergedSummary = {
        inserted:       json?.summary.inserted ?? 0,
        errors:         (json?.summary.errors ?? 0) + failedUploads.length,
        brand_id:       prepareData.brand_id,
        brand_name:     prepareData.brand_name,
        published_date: prepareData.published_date,
      };

      setResponse({ summary: mergedSummary, results: mergedResults });
      if (mergedSummary.inserted > 0) {
        setQueue(prev => prev.filter((_, i) => mergedResults[i]?.status !== "inserted"));
      }
    });
  }


  const canSubmit = brandName.trim() && publishedDate && queue.length > 0 && !pending;
  const today = new Date().toISOString().slice(0, 10);

  const PLATFORMS = [
    { value: "landing_page", label: "Landing Page" },
    { value: "youtube",      label: "YouTube" },
    { value: "meta",         label: "Meta" },
    { value: "tiktok",       label: "TikTok" },
    { value: "pinterest",    label: "Pinterest" },
    { value: "programmatic", label: "Programmatic" },
    { value: "ooh",          label: "OOH" },
    { value: "tvc",          label: "TVC" },
  ];
  const [platform, setPlatform] = useState("landing_page");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Dropzone ── */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "var(--color-accent)" : "var(--color-border)"}`,
          borderRadius: 14,
          padding: "40px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          background: isDragging ? "rgba(79,179,186,0.06)" : "var(--color-surface)",
          transition: "all 200ms ease",
        }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: "rgba(79,179,186,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UploadCloud size={24} color="var(--color-accent)" />
        </div>
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>
          {isDragging ? "Drop files here" : "Drag & drop files"}
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          MP4, MOV, JPG, PNG, WebP — up to {MAX_MB} MB each
        </p>
        <span style={{ fontSize: 12, color: "var(--color-accent)", fontWeight: 600, padding: "6px 16px", border: "1px solid var(--color-accent)", borderRadius: 6, marginTop: 4 }}>
          Browse files
        </span>
        <input ref={fileInputRef} type="file" multiple accept={ACCEPT_STRING} style={{ display: "none" }}
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* ── File queue ── */}
      {queue.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {queue.length} file{queue.length !== 1 ? "s" : ""} queued
            </p>
            <button type="button" onClick={() => setQueue([])} style={{ fontSize: 11, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
              Clear all
            </button>
          </div>
          {queue.map((qf, i) => (
            <FileItem key={qf.id} qf={qf} onRemove={() => removeFile(qf.id)} result={response?.results[i]} />
          ))}
        </div>
      )}

      {/* ── Metadata form ── */}
      <form id="manual-upload-form" onSubmit={handleSubmit}
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>Creative Metadata</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Applied to all files in this upload batch</p>
        </div>

        {/* Brand */}
        <div>
          <FieldLabel htmlFor="upload-brand-name">
            Brand <span style={{ color: "#f43f5e" }}>*</span>
          </FieldLabel>
          <BrandCombobox value={brandName} onChange={setBrandName} disabled={pending} />
          <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 5 }}>
            Type to search existing brands — or enter a new name to create one automatically
          </p>
        </div>

        {/* Brand website (shown when no existing match) */}
        <div>
          <FieldLabel htmlFor="upload-brand-website">Brand Website <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional, for new brands)</span></FieldLabel>
          <div style={{ position: "relative" }}>
            <Tag size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
            <input id="upload-brand-website" type="text" value={brandWebsite} onChange={e => setBrandWebsite(e.target.value)}
              placeholder="nike.com" disabled={pending} autoComplete="off"
              style={{ width: "100%", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px 10px 34px", color: "var(--color-text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", opacity: pending ? 0.5 : 1 }} />
          </div>
        </div>

        {/* Date + Platform row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <FieldLabel htmlFor="upload-date">
              Published Date <span style={{ color: "#f43f5e" }}>*</span>
            </FieldLabel>
            <div style={{ position: "relative" }}>
              <Calendar size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" }} />
              <input id="upload-date" type="date" value={publishedDate} onChange={e => setPublishedDate(e.target.value)}
                max={today} disabled={pending}
                style={{ width: "100%", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px 10px 34px", color: "var(--color-text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", opacity: pending ? 0.5 : 1 }} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="upload-platform">Platform</FieldLabel>
            <select id="upload-platform" value={platform} onChange={e => setPlatform(e.target.value)} disabled={pending}
              style={{ width: "100%", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px", color: "var(--color-text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box", opacity: pending ? 0.5 : 1 }}>
              {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Campaign ID */}
        <div>
          <FieldLabel htmlFor="upload-campaign">Campaign ID <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>(optional)</span></FieldLabel>
          <Input id="upload-campaign" value={campaignId} onChange={setCampaignId} placeholder="UUID of an existing campaign" disabled={pending} />
        </div>

        {/* Submit */}
        <button id="btn-upload-submit" type="submit" disabled={!canSubmit}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "12px 24px", borderRadius: 9, border: "none",
            background: canSubmit ? "linear-gradient(135deg, var(--color-accent), #22d3a0)" : "var(--color-surface-2)",
            color: "#fff", fontSize: 14, fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.55,
            transition: "all 200ms",
          }}>
          {pending
            ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />Uploading {queue.length} file{queue.length !== 1 ? "s" : ""}…</>
            : <><UploadCloud size={16} />Upload {queue.length > 0 ? `${queue.length} File${queue.length !== 1 ? "s" : ""}` : "Files"}</>}
        </button>
      </form>

      {/* ── Results ── */}
      {response && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14, animation: "fadeInUp 0.25s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <CheckCircle2 size={16} color="#22d3a0" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", flex: 1 }}>
              Uploaded to <strong style={{ color: "var(--color-accent)" }}>{response.summary.brand_name}</strong>
            </span>
            {([["Saved", response.summary.inserted, "#22d3a0"], ["Errors", response.summary.errors, "#f43f5e"]] as const).map(([label, val, color]) =>
              val > 0 ? <span key={label} style={{ fontSize: 12, fontWeight: 700, color, background: `${color}18`, borderRadius: 6, padding: "3px 10px" }}>{val} {label}</span> : null
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {response.results.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-surface-2)", borderRadius: 8, border: `1px solid ${r.status === "error" ? "rgba(244,63,94,0.2)" : "rgba(34,211,160,0.15)"}` }}>
                {r.status === "inserted" ? <CheckCircle2 size={14} color="#22d3a0" style={{ flexShrink: 0 }} /> : <AlertCircle size={14} color="#f43f5e" style={{ flexShrink: 0 }} />}
                <p style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</p>
                {r.status === "error" && <p style={{ fontSize: 11, color: "#f43f5e", flexShrink: 0 }}>{r.error}</p>}
                {r.status === "inserted" && r.storage_url && (
                  <a href={r.storage_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: "var(--color-accent)", textDecoration: "none", flexShrink: 0 }}>View ↗</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadError && (
        <div role="alert" style={{ display: "flex", gap: 10, padding: 14, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
          <AlertCircle size={16} color="#f43f5e" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: "#f43f5e" }}>{uploadError}</p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
