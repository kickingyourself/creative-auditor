"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SnapshotCard, type SnapshotCardData } from "@/components/SnapshotCard";

interface Props { snapshots: SnapshotCardData[] }

export function SnapshotGrid({ snapshots: initial }: Props) {
  const [snapshots, setSnapshots] = useState(initial);
  const router = useRouter();

  // Refresh preview_data (thumbnails) in the background on every mount.
  // The endpoint rebuilds all snapshot preview_data from live creatives,
  // then we re-fetch the page so updated thumbnails are shown immediately.
  useEffect(() => {
    fetch("/api/competitive-snapshots/refresh-previews", { method: "POST" })
      .then(r => r.ok ? router.refresh() : null)
      .catch(() => { /* non-fatal — stale thumbnails are fine */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDelete(id: string) {
    setSnapshots(prev => prev.filter(s => s.id !== id));
  }

  if (snapshots.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", textAlign: "center", marginTop: 40 }}>
        All snapshots deleted.
      </p>
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      gap: 20,
    }}>
      {snapshots.map(s => (
        <SnapshotCard key={s.id} snapshot={s} onDelete={handleDelete} />
      ))}
    </div>
  );
}
