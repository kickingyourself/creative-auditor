/**
 * lib/channels.ts
 * Shared channel taxonomy used by the campaign page and competitive analysis view.
 */

export const CHANNELS = [
  { key: "landing_page", label: "Landing Page", platforms: ["landing_page", "homepage"] },
  { key: "youtube",      label: "YouTube",      platforms: ["youtube"] },
  { key: "meta",         label: "Meta",         platforms: ["meta", "social"] },
  { key: "tiktok",       label: "TikTok",       platforms: ["tiktok"] },
  { key: "pinterest",    label: "Pinterest",    platforms: ["pinterest"] },
  { key: "programmatic", label: "Programmatic", platforms: ["programmatic", "display", "banner"] },
  { key: "ooh",          label: "OOH",          platforms: ["ooh", "outdoor"] },
  { key: "tvc",          label: "TVC",          platforms: ["tv", "tvc", "television"] },
] as const;

export type ChannelKey = typeof CHANNELS[number]["key"];

export function getChannelKey(platform: string): string {
  for (const ch of CHANNELS) {
    if ((ch.platforms as readonly string[]).includes(platform)) return ch.key;
  }
  return "other";
}

export interface ChannelSection<T> {
  key: string;
  label: string;
  items: T[];
}

export function groupByChannel<T extends { creative: { platform: string } }>(
  items: T[]
): ChannelSection<T>[] {
  const byChannel: Record<string, T[]> = {};
  for (const item of items) {
    const key = getChannelKey(item.creative.platform);
    (byChannel[key] ??= []).push(item);
  }
  return CHANNELS
    .filter(ch => (byChannel[ch.key]?.length ?? 0) > 0)
    .map(ch => ({ key: ch.key, label: ch.label, items: byChannel[ch.key] }));
}
