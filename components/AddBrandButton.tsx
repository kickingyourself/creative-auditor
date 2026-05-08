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
          padding: "10px 18px", borderRadius: "8px", border: "none",
          background: "var(--color-accent)",
          color: "#fff", fontSize: "13px", fontWeight: 600,
          cursor: "pointer",
          transition: "opacity 150ms ease, transform 150ms ease",
          boxShadow: "0 4px 14px rgba(79,179,186,0.3)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(79,179,186,0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(79,179,186,0.3)";
        }}
      >
        <Plus size={15} />
        Add Brand
      </button>

      <AddBrandModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
