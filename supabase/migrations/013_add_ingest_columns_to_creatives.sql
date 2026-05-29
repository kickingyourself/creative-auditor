-- 013_add_ingest_columns_to_creatives.sql
--
-- Phase 1: Add provenance + Silver enrichment columns to the existing
-- creatives table. All columns are nullable or have safe defaults so
-- existing rows and API routes continue working unchanged.
--
-- New columns:
--   ingest_source   — which system produced this creative
--   ingest_job_id   — FK to src_ingest_jobs (nullable for legacy rows)
--   storage_path    — Supabase Storage path (separate from source_url)
--   status          — lifecycle state
--   updated_at      — last modified timestamp

ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS ingest_source TEXT
    CHECK (ingest_source IN (
      'youtube_api','meta_api','tiktok_api','pinterest_api',
      'pmg_alli','manual_upload','web_scrape'
    )),
  ADD COLUMN IF NOT EXISTS ingest_job_id UUID
    REFERENCES src_ingest_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_path  TEXT,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('processing','active','archived','error')),
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now();

-- Back-fill ingest_source for rows we know came from manual uploads
-- (identified by the Supabase Storage CDN domain in source_url).
-- Adjust the domain string if your project has a different Supabase URL.
UPDATE creatives
SET ingest_source = 'manual_upload'
WHERE ingest_source IS NULL
  AND source_url LIKE '%supabase.co%';

-- Back-fill storage_path from source_url for uploaded assets.
-- Pattern: the path after the bucket name in the public CDN URL.
-- e.g. https://<project>.supabase.co/storage/v1/object/public/creative-assets/uploads/...
UPDATE creatives
SET storage_path = regexp_replace(
      source_url,
      '^.*/creative-assets/(.+)$',
      '\1'
    )
WHERE storage_path IS NULL
  AND source_url LIKE '%/creative-assets/%';

-- Index for common status + provenance lookups
CREATE INDEX IF NOT EXISTS idx_creatives_status
  ON creatives (status, brand_id);
CREATE INDEX IF NOT EXISTS idx_creatives_ingest_job
  ON creatives (ingest_job_id);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creatives_updated_at ON creatives;
CREATE TRIGGER trg_creatives_updated_at
  BEFORE UPDATE ON creatives
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMENT ON COLUMN creatives.ingest_source IS
  'Which system produced this creative: youtube_api, meta_api, manual_upload, pmg_alli, etc.';
COMMENT ON COLUMN creatives.ingest_job_id IS
  'FK to src_ingest_jobs.id — the ingest run that created this row. NULL for legacy rows.';
COMMENT ON COLUMN creatives.storage_path IS
  'Supabase Storage path for uploaded files (e.g. uploads/brand-id/filename.mp4). '
  'Separate from source_url which may contain a platform URL for API-sourced creatives.';
COMMENT ON COLUMN creatives.status IS
  'Lifecycle state: processing (thumbnail pending), active, archived, error.';
