import type { Metadata } from "next";
import { ManualUploadForm } from "@/components/ManualUploadForm";

export const metadata: Metadata = {
  title: "Upload Creatives — Creative Audit",
  description: "Manually upload finished ad creative files (MP4, images) and link them to brands.",
};

export default function UploadPage() {
  return (
    <div style={{ padding: "28px 28px 64px" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.025em", marginBottom: 6 }}>
          Upload Creatives
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          Upload finished ad creative files directly — MP4 videos and images.
          Files are stored in Supabase and linked to their brand automatically.
        </p>
      </div>

      <ManualUploadForm />
    </div>
  );
}
