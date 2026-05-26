"use client";

/**
 * components/SortableCreativeGrid.tsx
 *
 * Drop-in replacement for CreativeGrid that adds drag-and-drop reordering
 * within a channel section. Order is persisted immediately on drop via
 * PATCH /api/campaigns/{campaignId}/reorder.
 *
 * Uses @dnd-kit/core + @dnd-kit/sortable for accessible, pointer+touch-friendly DnD.
 */

import { useState, useCallback, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { CreativeCard } from "./CreativeCard";
import type { Creative } from "@/types";
import type { EditCreativePayload } from "./EditCreativeModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Item { creative: Creative; brandLogoUrl: string | null; }

interface Props {
  items: Item[];
  campaignId: string;
  platform: string;           // channel key — used in PATCH body
  heroCreativeId?: string | null;
  onToggleHero?: (id: string) => void;
  appendSlot?: ReactNode;
}

// ── Sortable card wrapper ──────────────────────────────────────────────────────

function SortableCard({
  item, index, heroCreativeId, onToggleHero, onDelete, onUpdate, isDraggingActive,
}: {
  item: Item;
  index: number;
  heroCreativeId?: string | null;
  onToggleHero?: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: EditCreativePayload & { brand_name?: string; campaign_name?: string }) => void;
  isDraggingActive: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.creative.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDraggingActive ? transition : undefined,
    opacity: isDragging ? 0.35 : 1,
    position: "relative",
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle — sits top-left, only visible on hover */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: 6,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.12)",
          cursor: isDragging ? "grabbing" : "grab",
          opacity: 0,
          transition: "opacity 150ms",
          color: "rgba(255,255,255,0.75)",
        }}
        className="drag-handle"
      >
        <GripVertical size={13} />
      </div>

      <CreativeCard
        creative={item.creative}
        index={index}
        brandLogoUrl={item.brandLogoUrl}
        onDelete={onDelete}
        onUpdate={onUpdate}
        isHero={!!heroCreativeId && item.creative.id === heroCreativeId}
        onToggleHero={onToggleHero}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SortableCreativeGrid({
  items: initialItems,
  campaignId,
  platform,
  heroCreativeId,
  onToggleHero,
  appendSlot,
}: Props) {
  const [list, setList] = useState<Item[]>(initialItems);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Delete / update handlers (same as CreativeGrid) ──────────────────────────

  function handleDelete(id: string) {
    setRemovingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setList(prev => prev.filter(item => item.creative.id !== id));
      setRemovingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }, 300);
  }

  function handleUpdate(id: string, patch: EditCreativePayload & { brand_name?: string; campaign_name?: string }) {
    setList(prev => prev.map(item => {
      if (item.creative.id !== id) return item;
      return {
        ...item,
        creative: {
          ...item.creative,
          brand_id: patch.brand_id,
          brand_name: patch.brand_name !== undefined ? patch.brand_name : item.creative.brand_name,
          campaign_id: patch.campaign_id,
          campaign_name: patch.campaign_name !== undefined ? patch.campaign_name ?? null : item.creative.campaign_name,
          title: patch.title !== null && patch.title !== undefined ? patch.title : item.creative.title,
          created_at: patch.created_at,
          published_at: patch.created_at,
        },
      };
    }));
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  const persistOrder = useCallback(async (orderedIds: string[]) => {
    setSaving(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ids: orderedIds }),
      });
    } finally {
      setSaving(false);
    }
  }, [campaignId, platform]);

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setList(prev => {
      const oldIdx = prev.findIndex(i => i.creative.id === active.id);
      const newIdx = prev.findIndex(i => i.creative.id === over.id);
      const next = arrayMove(prev, oldIdx, newIdx);
      persistOrder(next.map(i => i.creative.id));
      return next;
    });
  }

  const activeItem = activeId ? list.find(i => i.creative.id === activeId) : null;

  return (
    <>
      {/* Subtle saving indicator */}
      {saving && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 9999,
          padding: "6px 12px", borderRadius: 8,
          background: "rgba(79,179,186,0.15)",
          border: "1px solid rgba(79,179,186,0.3)",
          fontSize: 11, fontWeight: 600,
          color: "var(--color-accent)",
          backdropFilter: "blur(8px)",
        }}>
          Saving order…
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={list.map(i => i.creative.id)}
          strategy={rectSortingStrategy}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "18px",
              alignItems: "start",
            }}
          >
            {list.map((item, index) => (
              <div
                key={item.creative.id}
                style={{
                  opacity: removingIds.has(item.creative.id) ? 0 : 1,
                  transform: removingIds.has(item.creative.id) ? "scale(0.95)" : "scale(1)",
                  transition: "opacity 280ms ease, transform 280ms ease",
                }}
                // Show drag handle on hover
                onMouseEnter={e => {
                  const h = (e.currentTarget as HTMLDivElement).querySelector(".drag-handle") as HTMLDivElement | null;
                  if (h) h.style.opacity = "1";
                }}
                onMouseLeave={e => {
                  const h = (e.currentTarget as HTMLDivElement).querySelector(".drag-handle") as HTMLDivElement | null;
                  if (h) h.style.opacity = "0";
                }}
              >
                <SortableCard
                  item={item}
                  index={index}
                  heroCreativeId={heroCreativeId}
                  onToggleHero={onToggleHero}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  isDraggingActive={!!activeId}
                />
              </div>
            ))}
            {appendSlot}
          </div>
        </SortableContext>

        {/* Ghost card shown under the cursor while dragging */}
        <DragOverlay adjustScale={false}>
          {activeItem ? (
            <div style={{
              opacity: 0.9,
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              borderRadius: 12,
              transform: "rotate(1.5deg) scale(1.03)",
              cursor: "grabbing",
            }}>
              <CreativeCard
                creative={activeItem.creative}
                index={0}
                brandLogoUrl={activeItem.brandLogoUrl}
                onDelete={() => {}}
                onUpdate={() => {}}
                isHero={!!heroCreativeId && activeItem.creative.id === heroCreativeId}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Inject hover rule globally once */}
      <style>{`
        .drag-handle:hover { opacity: 1 !important; background: rgba(79,179,186,0.4) !important; }
      `}</style>
    </>
  );
}
