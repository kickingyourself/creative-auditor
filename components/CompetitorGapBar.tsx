"use client";

/**
 * components/CompetitorGapBar.tsx
 *
 * Compact channel-coverage strip for the competitor comparison columns.
 * Shows a horizontal row of mini SVG arc-gauges, one per channel,
 * styled dense and technical to fit below each brand header.
 */

import { CHANNEL_DEFS } from "@/components/ChannelGapDials";

interface ChannelSection {
  key: string;
  label: string;
  items: unknown[];
}

interface Props {
  channels: ChannelSection[];
}

// Mini gauge constants
const S   = 44;               // svg size px
const CX  = S / 2;
const CY  = S / 2;
const R   = 17;
const SW  = 3.5;
const C   = 2 * Math.PI * R;
const ARC = C * 0.75;         // 270° arc
const GAP = C - ARC;
const ROT = 135;              // rotate so gap is at bottom

function MiniDial({ platform, count, max, color }: {
  platform: string; count: number; max: number; color: string;
}) {
  const raw    = Math.min(count / max, 1);
  const pct    = Math.round(raw * 100);
  const filled = raw * ARC;

  // dot position at arc tip
  const angleDeg = ROT + raw * 270;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotX = CX + R * Math.cos(angleRad);
  const dotY = CY + R * Math.sin(angleRad);

  const done = raw >= 1;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      flexShrink: 0,
    }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-label={`${platform}: ${pct}%`}>
        {/* Track */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={color}
          strokeOpacity={0.15}
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${GAP}`}
          transform={`rotate(${ROT} ${CX} ${CY})`}
        />
        {/* Progress */}
        {filled > 0 && (
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${C - filled}`}
            transform={`rotate(${ROT} ${CX} ${CY})`}
            style={done ? { filter: `drop-shadow(0 0 3px ${color}99)` } : undefined}
          />
        )}
        {/* Dot */}
        {filled > 0 && (
          <circle cx={dotX} cy={dotY} r={2.5} fill={color} />
        )}
        {/* Pct label */}
        <text
          x={CX} y={CY + 3.5}
          textAnchor="middle"
          fill={pct > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)"}
          fontSize={pct === 100 ? 7 : 8.5}
          fontWeight={700}
          fontFamily="inherit"
        >
          {pct}%
        </text>
        {/* Completion glow ring */}
        {done && (
          <circle
            cx={CX} cy={CY} r={R + 2}
            fill="none"
            stroke={color}
            strokeOpacity={0.12}
            strokeWidth={1.5}
          />
        )}
      </svg>

      {/* Channel abbrev */}
      <span style={{
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--color-text-muted)",
        whiteSpace: "nowrap",
      }}>
        {platform === "landing_page" ? "LP" :
         platform === "programmatic" ? "PROG" :
         platform.slice(0, 3).toUpperCase()}
      </span>

      {/* count / max */}
      <span style={{
        fontSize: 8,
        color: "var(--color-text-muted)",
        opacity: 0.7,
        fontVariantNumeric: "tabular-nums",
      }}>
        {count}<span style={{ opacity: 0.5 }}>/{max}</span>
      </span>
    </div>
  );
}

export function CompetitorGapBar({ channels }: Props) {
  // Build platform→count map from the already-loaded channel data
  const counts: Record<string, number> = {};
  for (const ch of channels) {
    // Map channel key back to platform key used in CHANNEL_DEFS
    // channel key matches platform directly (landing_page, youtube, etc.)
    counts[ch.key] = (counts[ch.key] ?? 0) + ch.items.length;
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div style={{
      padding: "8px 12px 10px",
      borderBottom: "1px solid var(--color-border)",
      background: "var(--color-surface-2)",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-text-muted)",
        }}>
          Channel Coverage
        </span>
        <span style={{ fontSize: 9, color: "var(--color-text-muted)", opacity: 0.7 }}>
          {total} assets
        </span>
      </div>

      {/* Dial row */}
      <div style={{
        display: "flex",
        gap: 4,
        overflowX: "auto",
        paddingBottom: 2,
        scrollbarWidth: "none",
      }}>
        {CHANNEL_DEFS.map(def => (
          <MiniDial
            key={def.platform}
            platform={def.platform}
            count={counts[def.platform] ?? 0}
            max={def.max}
            color={def.color}
          />
        ))}
      </div>
    </div>
  );
}
