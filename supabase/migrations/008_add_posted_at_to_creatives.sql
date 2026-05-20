-- Migration 008: add posted_at to creatives
-- Stores the original publication date of the asset on its source platform
-- (e.g. YouTube video publishedAt, Pinterest pin date).
-- Nullable because upload-based assets don't have a platform-posted date.

ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN creatives.posted_at IS
  'When the asset was originally published on its source platform (YouTube, Pinterest, etc.). NULL for uploaded assets.';
