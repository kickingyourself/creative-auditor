-- 012_create_src_ingest_tables.sql
--
-- Phase 1: Bronze layer — source tracking tables.
--
-- Every ingest run (upload batch, API pull, MCP sync, scrape) creates one
-- src_ingest_jobs row. Source-specific tables (src_manual_uploads, etc.)
-- hold the raw per-asset records before normalization.
--
-- Design decisions:
--   • ingest_source is TEXT with CHECK (not an enum) — easier to extend as
--     new source types are added without a blocking DDL migration.
--   • All bronze tables are append-only: no UPDATE on existing rows except
--     fct_creative_id (set once after Silver promotion) and job status/counts.
--   • src_manual_uploads.fct_creative_id references creatives(id) ON DELETE SET NULL
--     so deleting a creative doesn't orphan the bronze audit row.

-- ─────────────────────────────────────────────────────────────────────────────
-- src_ingest_jobs — one row per ingest run
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS src_ingest_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which ingest source triggered this job
  source          TEXT NOT NULL
    CHECK (source IN (
      'youtube_api','meta_api','tiktok_api','pinterest_api',
      'pmg_alli','manual_upload','web_scrape'
    )),

  -- Context at time of ingest
  brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
  campaign_id     UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','done','partial','error')),
  asset_count     INTEGER,          -- files/URLs received in this job
  promoted_count  INTEGER,          -- rows successfully written to fct_creatives
  error_detail    TEXT,

  -- PMG Alli MCP connector metadata (populated for source = 'pmg_alli')
  mcp_tool_name   TEXT,
  mcp_response    JSONB,

  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_src_ingest_jobs_source
  ON src_ingest_jobs (source, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_src_ingest_jobs_brand
  ON src_ingest_jobs (brand_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_src_ingest_jobs_campaign
  ON src_ingest_jobs (campaign_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_src_ingest_jobs_status
  ON src_ingest_jobs (status) WHERE status IN ('pending','running');

COMMENT ON TABLE src_ingest_jobs IS
  'Bronze: one row per ingest run regardless of source. Append-only control table.';


-- ─────────────────────────────────────────────────────────────────────────────
-- src_manual_uploads — raw upload manifest (one row per uploaded file)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS src_manual_uploads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingest_job_id    UUID NOT NULL REFERENCES src_ingest_jobs(id) ON DELETE CASCADE,

  -- File identity as received from the browser
  original_name    TEXT NOT NULL,
  storage_path     TEXT NOT NULL,     -- path in Supabase Storage bucket
  storage_bucket   TEXT NOT NULL DEFAULT 'creative-assets',
  mime_type        TEXT NOT NULL,
  file_size_bytes  BIGINT,

  -- Set after Silver promotion (NULL until register/route.ts runs)
  fct_creative_id  UUID REFERENCES creatives(id) ON DELETE SET NULL,

  received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_src_manual_uploads_job
  ON src_manual_uploads (ingest_job_id);
CREATE INDEX IF NOT EXISTS idx_src_manual_uploads_creative
  ON src_manual_uploads (fct_creative_id);

COMMENT ON TABLE src_manual_uploads IS
  'Bronze: raw file manifest for every manually uploaded asset. Append-only.';
COMMENT ON COLUMN src_manual_uploads.fct_creative_id IS
  'Set to the creatives.id row created during Silver promotion. NULL until promoted.';
