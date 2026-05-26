/**
 * lib/captureVideoFrame.ts
 *
 * Client-side utility to extract a thumbnail JPEG from a video File or URL
 * using an off-screen <video> + Canvas. Works in any modern browser.
 *
 * @param source  A File object or a public URL string pointing to the video.
 * @param seekTo  Seconds into the video to capture. Defaults to 1s (or 10% of duration if shorter).
 * @returns       A JPEG Blob, or null if capture failed (codec unsupported, CORS, etc.).
 */
export async function captureVideoFrame(
  source: File | string,
  seekTo = 1,
): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const video   = document.createElement("video");
    const isFile  = source instanceof File;
    const blobUrl = isFile ? URL.createObjectURL(source) : null;

    video.src       = blobUrl ?? (source as string);
    video.muted     = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";   // needed for Supabase Storage URLs

    let settled = false;
    function done(blob: Blob | null) {
      if (settled) return;
      settled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      video.src = "";
      resolve(blob);
    }

    video.addEventListener("error", () => done(null));

    video.addEventListener("loadedmetadata", () => {
      // Seek to seekTo seconds, clamped to 10% of the video duration
      video.currentTime = Math.min(seekTo, video.duration * 0.1);
    });

    video.addEventListener("seeked", () => {
      try {
        const w   = video.videoWidth  || 1280;
        const h   = video.videoHeight || 720;
        const MAX = 1280; // cap thumbnail width to keep file small

        const scale   = w > MAX ? MAX / w : 1;
        const canvas  = document.createElement("canvas");
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) { done(null); return; }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => done(blob), "image/jpeg", 0.82);
      } catch {
        done(null);
      }
    });

    // Fallback timeout — if the video never fires seeked (e.g. bad codec)
    setTimeout(() => done(null), 12_000);

    video.load();
  });
}
