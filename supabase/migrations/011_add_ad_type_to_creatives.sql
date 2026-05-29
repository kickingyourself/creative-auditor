-- 011_add_ad_type_to_creatives.sql
--
-- Phase 0: Persist ad_type and file_format on every creative row.
--
-- Previously these were derived at the API layer from source_url extension
-- or content-type headers — meaning a row read later had no authoritative
-- record of what file type it was.
--
-- ad_type   — the ad unit's creative format (what the viewer experiences)
-- file_format — the underlying file encoding

ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS ad_type TEXT
    CHECK (ad_type IN ('video','image','pdf','html5','zip','carousel')),
  ADD COLUMN IF NOT EXISTS file_format TEXT
    CHECK (file_format IN (
      'jpg','png','gif','webp','avif',
      'pdf',
      'mp4','mov',
      'html5_bundle','zip',
      'other'
    ));

-- Back-fill existing rows using source_url file extension as best-effort.
-- Rows that cannot be determined remain NULL and will be fixed on next sync.
UPDATE creatives SET
  file_format = CASE
    WHEN source_url ILIKE '%.mp4'  THEN 'mp4'
    WHEN source_url ILIKE '%.mov'  THEN 'mov'
    WHEN source_url ILIKE '%.jpg'  THEN 'jpg'
    WHEN source_url ILIKE '%.jpeg' THEN 'jpg'
    WHEN source_url ILIKE '%.png'  THEN 'png'
    WHEN source_url ILIKE '%.gif'  THEN 'gif'
    WHEN source_url ILIKE '%.webp' THEN 'webp'
    WHEN source_url ILIKE '%.pdf'  THEN 'pdf'
    WHEN source_url ILIKE '%.zip'  THEN 'zip'
    WHEN source_url ILIKE '%.html' THEN 'html5_bundle'
    ELSE NULL
  END,
  ad_type = CASE
    WHEN source_url ILIKE '%.mp4'
      OR source_url ILIKE '%.mov'  THEN 'video'
    WHEN source_url ILIKE '%.pdf'  THEN 'pdf'
    WHEN source_url ILIKE '%.zip'
      OR source_url ILIKE '%.html' THEN 'html5'
    WHEN source_url ILIKE '%.jpg'
      OR source_url ILIKE '%.jpeg'
      OR source_url ILIKE '%.png'
      OR source_url ILIKE '%.gif'
      OR source_url ILIKE '%.webp' THEN 'image'
    ELSE NULL
  END
WHERE file_format IS NULL;

COMMENT ON COLUMN creatives.ad_type IS
  'Creative format as experienced by the viewer: video, image, pdf, html5, zip, carousel.';
COMMENT ON COLUMN creatives.file_format IS
  'Underlying file encoding: mp4, jpg, png, pdf, zip, html5_bundle, etc.';
