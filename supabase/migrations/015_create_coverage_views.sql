-- 015_create_coverage_views.sql
--
-- Phase 4: Coverage views for competitor-relative gap analysis.
--
-- vw_brand_channel_counts
--   Per-brand, per-platform, per-campaign asset counts across all active creatives.
--   Intermediate view used by rpt_channel_coverage.
--
-- rpt_channel_coverage
--   The primary serving view for ChannelGapDials.
--   For a given competitor set, shows every member brand's asset count per channel,
--   alongside set-wide statistics (median, max, average).
--   The focal brand's gap vs. the set is computed here.
--
-- No materialized view yet — regular views are fine at current scale.
-- To convert to MATERIALIZED VIEW later: replace CREATE VIEW with
--   CREATE MATERIALIZED VIEW ... and add a refresh call after each ingest job.

-- ─────────────────────────────────────────────────────────────────────────────
-- vw_brand_channel_counts
-- One row per (brand, platform, campaign_id). campaign_id is nullable
-- (NULL = counts across all campaigns for the brand).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_brand_channel_counts AS
SELECT
  c.brand_id,
  b.name                   AS brand_name,
  c.platform,
  c.campaign_id,
  COUNT(c.id)              AS asset_count
FROM creatives c
JOIN brands b ON b.id = c.brand_id
WHERE c.status = 'active'
GROUP BY c.brand_id, b.name, c.platform, c.campaign_id;

COMMENT ON VIEW vw_brand_channel_counts IS
  'Silver helper: active creative counts per brand, platform, and campaign.';


-- ─────────────────────────────────────────────────────────────────────────────
-- rpt_channel_coverage
-- Joins set membership → brand counts → set statistics.
-- Callers filter by set_id (and optionally campaign_id).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW rpt_channel_coverage AS
WITH member_counts AS (
  -- All members of all sets with their per-channel counts (NULL = 0)
  SELECT
    m.set_id,
    m.brand_id,
    m.is_focal,
    b.name                                        AS brand_name,
    p.platform,
    COALESCE(cc.asset_count, 0)                   AS asset_count,
    cc.campaign_id
  FROM dim_competitor_set_members m
  JOIN brands b ON b.id = m.brand_id
  -- Cross join with distinct platforms so every brand has a row for every
  -- channel in the set, even if count is zero.
  CROSS JOIN (
    SELECT DISTINCT platform FROM creatives WHERE status = 'active'
  ) p
  LEFT JOIN vw_brand_channel_counts cc
    ON  cc.brand_id   = m.brand_id
    AND cc.platform   = p.platform
),
set_stats AS (
  -- Aggregate per (set, platform, campaign_id)
  SELECT
    set_id,
    platform,
    campaign_id,
    ROUND(AVG(asset_count))                       AS set_avg,
    MAX(asset_count)                               AS set_max,
    PERCENTILE_CONT(0.5) WITHIN GROUP
      (ORDER BY asset_count)                       AS set_median
  FROM member_counts
  GROUP BY set_id, platform, campaign_id
)
SELECT
  mc.set_id,
  mc.brand_id,
  mc.brand_name,
  mc.is_focal,
  mc.platform,
  mc.campaign_id,
  mc.asset_count                                  AS focal_count,
  ss.set_avg,
  ss.set_max,
  ss.set_median,
  mc.asset_count - ss.set_median                  AS gap_vs_median,
  mc.asset_count - ss.set_max                     AS gap_vs_leader,
  CASE
    WHEN ss.set_max > 0
      THEN ROUND((mc.asset_count::numeric / ss.set_max) * 100, 1)
    ELSE 0
  END                                             AS pct_of_leader
FROM member_counts mc
JOIN set_stats ss
  ON  ss.set_id   = mc.set_id
  AND ss.platform = mc.platform
  AND ss.campaign_id IS NOT DISTINCT FROM mc.campaign_id;

COMMENT ON VIEW rpt_channel_coverage IS
  'Gold: focal brand asset count vs. competitor set stats per channel. '
  'Filter by set_id. is_focal=true rows are the brand being evaluated.';
