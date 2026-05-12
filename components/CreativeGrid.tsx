"use client";

/**
 * components/CreativeGrid.tsx
 *
 * Thin client wrapper around the creative card grid.
 * Holds the local list of creatives in state so that when a card's
 * onDelete fires the card animates out immediately, and when onUpdate
 * fires the card's metadata patches optimistically — both without a
 * full server round-trip.
 */

import { useState } from "react";
import { Creative } from "@/types";
import { CreativeCard } from "./CreativeCard";
import type { EditCreativePayload } from "./EditCreativeModal";

interface Props {
  items: { creative: Creative; brandLogoUrl: string | null }[];
  /** ID of the current hero creative — if set, shows crown UI on all cards */
  heroCreativeId?: string | null;
  /** Called when the crown button is toggled on a card */
  onToggleHero?: (id: string) => void;
}

export function CreativeGrid({ items, heroCreativeId, onToggleHero }: Props) {
  const [list, setList] = useState(items);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  function handleDelete(id: string) {
    setRemovingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setList(prev => prev.filter(item => item.creative.id !== id));
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }

  function handleUpdate(id: string, patch: EditCreativePayload & { brand_name?: string; campaign_name?: string }) {
    setList(prev =>
      prev.map(item => {
        if (item.creative.id !== id) return item;
        return {
          ...item,
          creative: {
            ...item.creative,
            brand_id: patch.brand_id,
            brand_name: patch.brand_name !== undefined ? patch.brand_name : item.creative.brand_name,
            campaign_id: patch.campaign_id,
            campaign_name: patch.campaign_name !== undefined ? patch.campaign_name ?? null : item.creative.campaign_name,
            title: patch.title !== null && patch.title !== undefined
              ? patch.title
              : item.creative.title,
            created_at: patch.created_at,
            published_at: patch.created_at,
          },
        };
      })
    );
  }

  return (
    <div
      id="creatives-grid"
      className="stagger-children"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "18px",
        alignItems: "start",
      }}
    >
      {list.map(({ creative, brandLogoUrl }, i) => (
        <div
          key={creative.id}
          style={{
            opacity: removingIds.has(creative.id) ? 0 : 1,
            transform: removingIds.has(creative.id) ? "scale(0.95)" : "scale(1)",
            transition: "opacity 280ms ease, transform 280ms ease",
          }}
        >
          <CreativeCard
            creative={creative}
            index={i}
            brandLogoUrl={brandLogoUrl}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            isHero={!!heroCreativeId && creative.id === heroCreativeId}
            onToggleHero={onToggleHero}
          />
        </div>
      ))}
    </div>
  );
}
