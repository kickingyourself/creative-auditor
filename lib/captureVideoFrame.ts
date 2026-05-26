/**
 * lib/captureVideoFrame.ts
 *
 * Client-side utility to extract a thumbnail JPEG from a video File or URL
 * using an off-screen <video> + Canvas. Works in any modern browser.
 *
 * Key correctness rules:
 *   1. crossOrigin must be set BEFORE src (otherwise canvas is tainted).
 *   2. `seeked` fires before the frame is decoded — wait for rAF + delay.
 *   3. `seeked` can fire spuriously at t=0 on initial load — guard it.
 *   4. Large files take longer to decode — retry if canvas is black.
 */
export async function captureVideoFrame(
  source: File | string,
  seekTo = 1,
): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const video    = document.createElement("video");
    const isFile   = source instanceof File;
    const blobUrl  = isFile ? URL.createObjectURL(source) : null;

    // ⚠️ crossOrigin MUST be set before src — otherwise the browser starts
    //    loading without CORS mode and canvas.toBlob() will be tainted/null.
    video.crossOrigin = "anonymous";
    video.muted       = true;
    video.playsInline = true;
    video.preload     = "auto";
    video.src         = blobUrl ?? (source as string);

    let settled   = false;
    let hasSought = false;

    function done(blob: Blob | null) {
      if (settled) return;
      settled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      video.src = "";
      resolve(blob);
    }

    /** Returns true if the captured canvas looks like a black/empty frame. */
    function isBlackFrame(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
      // Sample a 16×16 patch from the centre of the frame
      const sx = Math.floor(w / 2) - 8;
      const sy = Math.floor(h / 2) - 8;
      const { data } = ctx.getImageData(Math.max(0, sx), Math.max(0, sy), 16, 16);
      let total = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += data[i] + data[i + 1] + data[i + 2]; // R+G+B
      }
      // Average brightness < 8 → treat as black
      return total / (data.length / 4) < 8;
    }

    function captureFrame(attempt = 0) {
      try {
        const w      = video.videoWidth  || 1280;
        const h      = video.videoHeight || 720;
        const MAX    = 1280;
        const scale  = w > MAX ? MAX / w : 1;

        const canvas  = document.createElement("canvas");
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) { done(null); return; }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // If the frame looks black and we still have retries, wait and try again
        if (isBlackFrame(ctx, canvas.width, canvas.height) && attempt < 6) {
          const delay = 150 * (attempt + 1); // 150ms, 300ms, 450ms … up to 900ms
          setTimeout(() => captureFrame(attempt + 1), delay);
          return;
        }

        canvas.toBlob(blob => done(blob ?? null), "image/jpeg", 0.85);
      } catch {
        done(null);
      }
    }

    function afterSeek() {
      // rAF ensures the frame enters the compositor; setTimeout gives the
      // decoder extra headroom for large/complex files before we try canvas.
      requestAnimationFrame(() => {
        setTimeout(() => requestAnimationFrame(() => captureFrame()), 80);
      });
    }

    video.addEventListener("error", () => done(null));

    video.addEventListener("loadedmetadata", () => {
      const target = Math.min(seekTo, Math.max(0.01, video.duration - 0.05));
      video.currentTime = target;
      hasSought = true;
    });

    video.addEventListener("seeked", () => {
      if (!hasSought || video.currentTime < seekTo * 0.5) return;
      afterSeek();
    });

    // Hard timeout — 20s to allow large files to buffer and decode
    setTimeout(() => done(null), 20_000);

    video.load();
  });
}
