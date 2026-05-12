"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddBrandModal } from "@/components/AddBrandModal";

export function AddBrandButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        id="btn-add-brand"
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: "7px",
          padding: "10px 18px", borderRadius: "8px",
          background: "var(--color-accent)",
          color: "#0a1a1b",
          fontSize: "13px", fontWeight: 700,
          cursor: "pointer",
          transition: "background 200ms ease, border-color 200ms ease",
          border: "1px solid transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)";
          (e.currentTarget as HTMLButtonElement).style.background = "#1ab88a";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)";
        }}
      >
        <Plus size={15} />
        Add Brand
      </button>

      <AddBrandModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
