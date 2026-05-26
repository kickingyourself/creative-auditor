/**
 * components/ChannelGapDials.tsx
 *
 * Gap analysis bar — a horizontal row of small SVG arc-gauge dials,
 * one per channel. Shows library-wide creative coverage vs. a target.
 *
 * Targets:
 *   landing_page  → 3 creatives = 100%
 *   all others    → 20 creatives = 100%
 */

"use client";

// ── Channel definitions ───────────────────────────────────────────────────────

export interface ChannelDef {
  platform: string;      // matches DB platform value
  label: string;
  max: number;           // count that = 100%
  color: string;         // arc color
  trackColor?: string;   // unfilled track (defaults to semi-transparent color)
}

export const CHANNEL_DEFS: ChannelDef[] = [
  { platform: "youtube",      label: "YouTube",      max: 20, color: "#ff4444" },
  { platform: "pinterest",    label: "Pinterest",    max: 20, color: "#e60023" },
  { platform: "tiktok",       label: "TikTok",       max: 20, color: "#69c9d0" },
  { platform: "landing_page", label: "Landing Page", max: 3,  color: "#22d3a0" },
  { platform: "meta",         label: "Meta",         max: 20, color: "#1877f2" },
  { platform: "social",       label: "Social",       max: 20, color: "#a78bfa" },
  { platform: "programmatic", label: "Programmatic", max: 20, color: "#f59e0b" },
  { platform: "ooh",          label: "OOH",          max: 20, color: "#06b6d4" },
  { platform: "tvc",          label: "TVC",          max: 20, color: "#8b5cf6" },
];

// ── Single dial ───────────────────────────────────────────────────────────────

const SIZE    = 72;   // viewBox & rendered width/height (px)
const CX      = SIZE / 2;
const CY      = SIZE / 2;
const RADIUS  = 27;
const STROKE  = 5;
const CIRC    = 2 * Math.PI * RADIUS;       // full circumference
const ARC_DEG = 270;                         // degrees the gauge spans
const ARC_LEN = CIRC * (ARC_DEG / 360);     // arc length of the track
const GAP_LEN = CIRC - ARC_LEN;             // gap at the bottom
const START_ROTATION = 135;                  // rotate so gap is centred at bottom

function Dial({ def, count }: { def: ChannelDef; count: number }) {
  const raw = Math.min(count / def.max, 1);       // 0–1, capped at 1
  const pct = Math.round(raw * 100);

  // progress arc length
  const filled = raw * ARC_LEN;

  // position of the dot at the progress end
  // angle in SVG space: rotate(135) + raw*270 degrees, then add 135° offset
  const angleDeg = START_ROTATION + raw * ARC_DEG;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotX = CX + RADIUS * Math.cos(angleRad);
  const dotY = CY + RADIUS * Math.sin(angleRad);

  const trackOpacity = 0.15;
  const isComplete   = raw >= 1;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    }}>
      {/* SVG gauge */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-label={`${def.label}: ${pct}%`}
      >
        {/* Track (unfilled) */}
        <circle
          cx={CX} cy={CY} r={RADIUS}
          fill="none"
          stroke={def.color}
          strokeOpacity={trackOpacity}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LEN} ${GAP_LEN}`}
          transform={`rotate(${START_ROTATION} ${CX} ${CY})`}
        />

        {/* Progress arc */}
        {filled > 0 && (
          <circle
            cx={CX} cy={CY} r={RADIUS}
            fill="none"
            stroke={def.color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRC - filled}`}
            transform={`rotate(${START_ROTATION} ${CX} ${CY})`}
            style={{ filter: isComplete ? `drop-shadow(0 0 4px ${def.color}88)` : undefined }}
          />
        )}

        {/* Progress dot */}
        {filled > 0 && (
          <circle
            cx={dotX} cy={dotY} r={3.5}
            fill={def.color}
            style={{ filter: `drop-shadow(0 0 3px ${def.color})` }}
          />
        )}

        {/* Percentage text */}
        <text
          x={CX}
          y={CY + 5}
          textAnchor="middle"
          fill={pct > 0 ? "var(--color-text-primary)" : "var(--color-text-muted)"}
          fontSize={pct === 100 ? 11 : 13}
          fontWeight={700}
          fontFamily="inherit"
        >
          {pct}%
        </text>

        {/* Subtle completion ring glow */}
        {isComplete && (
          <circle
            cx={CX} cy={CY} r={RADIUS + 3}
            fill="none"
            stroke={def.color}
            strokeOpacity={0.12}
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Label */}
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        color: "var(--color-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}>
        {def.label}
      </span>

      {/* Count / max */}
      <span style={{
        fontSize: 10,
        color: "var(--color-text-muted)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {count}<span style={{ opacity: 0.5 }}>/{def.max}</span>
      </span>
    </div>
  );
}

// ── Gap analysis strip ────────────────────────────────────────────────────────

interface Props {
  /** Raw platform counts from the DB — keyed by platform string */
  platformCounts: Record<string, number>;
}

export function ChannelGapDials({ platformCounts }: Props) {
  // Normalise: merge 'homepage' into 'landing_page'
  const counts = { ...platformCounts };
  if (counts["homepage"]) {
    counts["landing_page"] = (counts["landing_page"] ?? 0) + counts["homepage"];
    delete counts["homepage"];
  }

  const totalCreatives = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 14,
      padding: "16px 20px",
      marginBottom: 24,
    }}>
      {/* Section label */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          color: "var(--color-text-muted)",
        }}>
          Channel Coverage
        </span>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          {totalCreatives} creatives total
        </span>
      </div>

      {/* Dials row */}
      <div style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,   // room for scrollbar
      }}>
        {CHANNEL_DEFS.map((def) => (
          <Dial
            key={def.platform}
            def={def}
            count={counts[def.platform] ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
