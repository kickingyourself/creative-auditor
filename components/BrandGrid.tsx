"use client";

/**
 * components/BrandGrid.tsx
 *
 * Client wrapper that manages the local brand list in state so that deleting
 * a brand card animates it out immediately without a full server re-render.
 */

import { useState } from "react";
import { BrandCard, type BrandWithCount } from "./BrandCard";

interface Props {
  brands: BrandWithCount[];
}

export function BrandGrid({ brands }: Props) {
  const [list, setList] = useState(brands);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  function handleDelete(id: string) {
    setRemovingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setList(prev => prev.filter(b => b.id !== id));
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
      gap: "20px",
    }}>
      {list.map((brand, i) => (
        <div
          key={brand.id}
          style={{
            opacity: removingIds.has(brand.id) ? 0 : 1,
            transform: removingIds.has(brand.id) ? "scale(0.96) translateY(-4px)" : "scale(1) translateY(0)",
            transition: "opacity 300ms ease, transform 300ms ease",
          }}
        >
          <BrandCard
            brand={brand}
            index={i}
            onDelete={handleDelete}
          />
        </div>
      ))}
    </div>
  );
}
