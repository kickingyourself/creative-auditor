/**
 * lib/captureVideoFrame.ts
 *
 * Client-side utility to extract a thumbnail JPEG from a video File or URL
 * using an off-screen <video> + Canvas. Works in any modern browser.
 *
 * Key correctness rules:
 *   1. crossOrigin must be set BEFORE src (otherwise canvas is tainted).
 *   2. `seeked` fires before the frame is decoded — wait for a rAF cycle.
 *   3. `seeked` can fire spuriously at t=0 on initial load — guard it.
 *
 * @param source  A File object or a public URL string pointing to the video.
 * @param seekTo  Seconds into the video to capture. Defaults to 1s.
 * @returns       A JPEG Blob, or null if capture failed.
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
    video.preload     = "auto";           // need frame data, not just metadata
    video.src         = blobUrl ?? (source as string);

    let settled    = false;
    let hasSought  = false;              // guard against t=0 spurious seeked

    function done(blob: Blob | null) {
      if (settled) return;
      settled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      video.src = "";
      resolve(blob);
    }

    function captureFrame() {
      // Double rAF: first frame queues decode, second confirms it's painted.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
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
            canvas.toBlob(blob => done(blob ?? null), "image/jpeg", 0.85);
          } catch {
            done(null);
          }
        });
      });
    }

    video.addEventListener("error", () => done(null));

    video.addEventListener("loadedmetadata", () => {
      const target = Math.min(seekTo, Math.max(0.01, video.duration - 0.05));
      video.currentTime = target;
      hasSought = true;
    });

    video.addEventListener("seeked", () => {
      // Ignore the initial t=0 seek that fires before our explicit seek
      if (!hasSought || video.currentTime < seekTo * 0.5) return;
      captureFrame();
    });

    // Fallback: if seeked never fires (network error, unsupported codec)
    setTimeout(() => done(null), 15_000);

    video.load();
  });
}
