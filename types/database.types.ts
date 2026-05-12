/**
 * database.types.ts
 *
 * Hand-authored TypeScript types that map 1-to-1 with the SQL schema
 * defined in supabase/migrations/001_initial_schema.sql.
 *
 * Usage with the Supabase client:
 *   import { createClient } from '@supabase/supabase-js'
 *   import type { Database } from '@/types/database.types'
 *   const supabase = createClient<Database>(url, key)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enum
// ─────────────────────────────────────────────────────────────────────────────

/** Maps to the `platform_type` Postgres enum.
 *  'homepage' = legacy value still in DB; app layer normalises to 'landing_page' on read.
 *  Run this in Supabase SQL editor to enable all platform types:
 *    ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'landing_page';
 *    ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'programmatic';
 *    ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'ooh';
 *    ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'tvc';
 */
export type PlatformType = 'youtube' | 'tiktok' | 'landing_page' | 'homepage' | 'social' | 'pinterest' | 'programmatic' | 'ooh' | 'tvc';


// ─────────────────────────────────────────────────────────────────────────────
// Row types  (what Supabase returns from SELECT)
// ─────────────────────────────────────────────────────────────────────────────

export interface BrandRow {
  /** UUID primary key, auto-generated. */
  id: string;
  /** Display name of the brand. */
  name: string;
  /** Public URL of the brand logo (stored in creative-assets bucket). Nullable. */
  logo_url: string | null;
  /** Canonical brand homepage URL used as seed for scraping. Nullable. */
  website_url: string | null;
  /** ISO-8601 timestamp of record creation (with timezone). */
  created_at: string;
}

export interface CampaignRow {
  /** UUID primary key, auto-generated. */
  id: string;
  /** FK → brands.id. Cascades on brand deletion. */
  brand_id: string;
  /** Human-readable campaign name. */
  name: string;
  /** Inclusive start date in YYYY-MM-DD format. Nullable if unknown. */
  start_date: string | null;
  /** Inclusive end date in YYYY-MM-DD format. Nullable if ongoing. */
  end_date: string | null;
  /** FK → creatives.id. The pinned hero creative for the campaign dashboard. Nullable. */
  hero_creative_id: string | null;
  /** ISO-8601 timestamp of record creation (with timezone). */
  created_at: string;
}

export interface CreativeRow {
  /** UUID primary key, auto-generated. */
  id: string;
  /** FK → brands.id. Cascades on brand deletion. */
  brand_id: string;
  /**
   * FK → campaigns.id. Nullable — a creative may exist outside any campaign.
   * Set to NULL when the referenced campaign is deleted (ON DELETE SET NULL).
   */
  campaign_id: string | null;
  /** Source platform of the creative. */
  platform: PlatformType;
  /** Canonical URL of the ad unit (YouTube watch URL, TikTok share URL, etc.). */
  source_url: string;
  /**
   * Optional user-provided title. NULL = auto-derive from source_url + platform.
   * Added in migration 003_add_title_to_creatives.sql.
   */
  title: string | null;
  /**
   * Cached thumbnail URL from the creative-assets Supabase Storage bucket.
   * Nullable until the thumbnail has been fetched and cached.
   */
  thumbnail_url: string | null;
  /**
   * Total view count at last sync. Uses number (JS safe integer).
   * Nullable if not yet fetched.
   */
  view_count: number | null;
  /**
   * Engagement rate as a decimal fraction (e.g. 0.0342 = 3.42%).
   * Stored as numeric(5,4) in Postgres; returned as string by some drivers —
   * parse with parseFloat() if you need arithmetic.
   * Nullable if not yet computed.
   */
  engagement_rate: number | null;
  /** ISO-8601 timestamp of record creation (with timezone). */
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert types  (what you pass to INSERT / upsert)
// ─────────────────────────────────────────────────────────────────────────────

/** Required and optional fields when inserting a new brand. */
export interface BrandInsert {
  /** Omit to let Postgres generate a UUID. */
  id?: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  /** Omit to use the DB default (now()). */
  created_at?: string;
}

/** Required and optional fields when inserting a new campaign. */
export interface CampaignInsert {
  id?: string;
  brand_id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string;
}

/** Required and optional fields when inserting a new creative. */
export interface CreativeInsert {
  id?: string;
  brand_id: string;
  campaign_id?: string | null;
  platform: PlatformType;
  source_url: string;
  title?: string | null;
  thumbnail_url?: string | null;
  view_count?: number | null;
  engagement_rate?: number | null;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update types  (all fields optional for PATCH-style updates)
// ─────────────────────────────────────────────────────────────────────────────

export type BrandUpdate = Partial<Omit<BrandInsert, 'id' | 'created_at'>>;

export type CampaignUpdate = Partial<
  Omit<CampaignInsert, 'id' | 'brand_id' | 'created_at'>
>;

/**
 * All fields that may be patched on a creative.
 * brand_id, title, created_at, and campaign_id are exposed for the edit UI.
 */
export interface CreativeUpdate {
  brand_id?: string;
  campaign_id?: string | null;
  platform?: PlatformType;
  source_url?: string;
  title?: string | null;
  thumbnail_url?: string | null;
  view_count?: number | null;
  engagement_rate?: number | null;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Database generic type
// Pass this to createClient<Database>() for full end-to-end type safety.
// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: BrandRow;
        Insert: BrandInsert;
        Update: BrandUpdate;
      };
      campaigns: {
        Row: CampaignRow;
        Insert: CampaignInsert;
        Update: CampaignUpdate;
      };
      creatives: {
        Row: CreativeRow;
        Insert: CreativeInsert;
        Update: CreativeUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      platform_type: PlatformType;
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience join types  (for common relational queries)
// ─────────────────────────────────────────────────────────────────────────────

/** A creative with its parent brand eagerly joined. */
export interface CreativeWithBrand extends CreativeRow {
  brand: BrandRow;
}

/** A creative with its optional parent campaign eagerly joined. */
export interface CreativeWithCampaign extends CreativeRow {
  campaign: CampaignRow | null;
}

/** A creative with both brand and campaign eagerly joined. */
export interface CreativeWithRelations extends CreativeRow {
  brand: BrandRow;
  campaign: CampaignRow | null;
}

/** A campaign with all its creatives eagerly joined. */
export interface CampaignWithCreatives extends CampaignRow {
  creatives: CreativeRow[];
}

/** A brand with all its campaigns eagerly joined. */
export interface BrandWithCampaigns extends BrandRow {
  campaigns: CampaignRow[];
}
