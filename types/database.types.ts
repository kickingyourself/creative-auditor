/**
 * database.types.ts
 *
 * Hand-authored TypeScript types that map 1-to-1 with the SQL schema.
 * Updated to reflect Medallion Bronze/Silver columns added in migrations 011-013.
 *
 * Usage with the Supabase client:
 *   import { createClient } from '@supabase/supabase-js'
 *   import type { Database } from '@/types/database.types'
 *   const supabase = createClient<Database>(url, key)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enums — map to Postgres CHECK constraints or enum types
// ─────────────────────────────────────────────────────────────────────────────

/** Maps to the `platform_type` Postgres enum. */
export type PlatformType =
  | 'youtube' | 'tiktok' | 'landing_page' | 'homepage'
  | 'social'  | 'pinterest' | 'programmatic'
  | 'ooh'     | 'tvc'       | 'meta';

/** Which system produced the creative (TEXT + CHECK in Postgres). */
export type IngestSourceType =
  | 'youtube_api' | 'meta_api'  | 'tiktok_api' | 'pinterest_api'
  | 'pmg_alli'    | 'manual_upload' | 'web_scrape';

/** Ad unit format as experienced by the viewer (TEXT + CHECK). */
export type AdType = 'video' | 'image' | 'pdf' | 'html5' | 'zip' | 'carousel';

/** Underlying file encoding (TEXT + CHECK). */
export type FileFormatType =
  | 'jpg' | 'png' | 'gif' | 'webp' | 'avif'
  | 'pdf'
  | 'mp4' | 'mov'
  | 'html5_bundle' | 'zip'
  | 'other';

/** Creative lifecycle state (TEXT + CHECK). */
export type CreativeStatusType = 'processing' | 'active' | 'archived' | 'error';

/** src_ingest_jobs lifecycle (TEXT + CHECK). */
export type IngestJobStatus = 'pending' | 'running' | 'done' | 'partial' | 'error';


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
  /** Canonical URL of the ad unit or Supabase CDN URL for uploads. @deprecated use storage_path or platform_url */
  source_url: string;
  /** Optional user-provided title. */
  title: string | null;
  /** Cached thumbnail URL from Supabase Storage. */
  thumbnail_url: string | null;

  // ── Silver enrichment (migrations 011-013) ───────────────────────────────
  /** Which system produced this creative. NULL for legacy rows. */
  ingest_source: IngestSourceType | null;
  /** FK → src_ingest_jobs.id. NULL for legacy rows. */
  ingest_job_id: string | null;
  /** Supabase Storage path for uploaded files. NULL for API-sourced creatives. */
  storage_path: string | null;
  /** Ad unit format as experienced by the viewer. */
  ad_type: AdType | null;
  /** Underlying file encoding. */
  file_format: FileFormatType | null;
  /** Lifecycle state. Defaults to 'active'. */
  status: CreativeStatusType;

  // ── Metrics (deprecated — moving to fct_creative_metrics) ───────────────
  /** @deprecated Use fct_creative_metrics for time-series data. */
  view_count: number | null;
  /** @deprecated Use fct_creative_metrics for time-series data. */
  engagement_rate: number | null;

  /** When the asset was originally published on its source platform. */
  posted_at: string | null;
  /** Display sort order within (campaign_id, platform). */
  sort_order: number | null;
  /** ISO-8601 timestamp of record creation. */
  created_at: string;
  /** ISO-8601 timestamp of last modification (auto-updated by trigger). */
  updated_at: string;
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
  // Silver columns
  ingest_source?: IngestSourceType | null;
  ingest_job_id?: string | null;
  storage_path?: string | null;
  ad_type?: AdType | null;
  file_format?: FileFormatType | null;
  status?: CreativeStatusType;
  // Deprecated metrics
  view_count?: number | null;
  engagement_rate?: number | null;
  posted_at?: string | null;
  created_at?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Update types  (all fields optional for PATCH-style updates)
// ─────────────────────────────────────────────────────────────────────────────

export type BrandUpdate = Partial<Omit<BrandInsert, 'id' | 'created_at'>>;

export type CampaignUpdate = Partial<
  Omit<CampaignInsert, 'id' | 'brand_id' | 'created_at'>
> & {
  /** Pinned hero creative for the campaign dashboard. */
  hero_creative_id?: string | null;
};

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
