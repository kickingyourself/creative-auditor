"use client";

import { useState } from "react";
import { SnapshotCard, type SnapshotCardData } from "@/components/SnapshotCard";

interface Props { snapshots: SnapshotCardData[] }

export function SnapshotGrid({ snapshots: initial }: Props) {
  const [snapshots, setSnapshots] = useState(initial);

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
