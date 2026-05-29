-- 016_create_eval_scorecards.sql
--
-- Phase 5: Creative director evaluation / scorecard table.
--
-- Every scorecard is scoped to a campaign AND a creative.
-- campaign_id is NOT NULL — scorecards must be tied to a campaign.
--
-- Scoring dimensions (1–5, NULL = not rated):
--   concept    — is the idea strong and original?
--   craft      — is the execution high quality?
--   brand_fit  — does it feel on-brand?
--   message    — is the message clear and compelling?
--   cta        — is there a clear call-to-action?
--
-- score_overall is nullable — can be set explicitly or left to the UI
-- to compute as the average of the non-null dimension scores.

CREATE TABLE IF NOT EXISTS eval_creative_scorecards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Required context — both FK columns are NOT NULL
  creative_id      UUID NOT NULL REFERENCES creatives(id)  ON DELETE CASCADE,
  campaign_id      UUID NOT NULL REFERENCES campaigns(id)  ON DELETE CASCADE,

  -- Reviewer (auth.users FK once Supabase Auth is wired; nullable for now)
  reviewer_id      UUID,
  reviewer_name    TEXT NOT NULL DEFAULT 'Anonymous',

  -- Dimension scores (1–5, nullable if not rated)
  score_concept    SMALLINT CHECK (score_concept    BETWEEN 1 AND 5),
  score_craft      SMALLINT CHECK (score_craft      BETWEEN 1 AND 5),
  score_brand_fit  SMALLINT CHECK (score_brand_fit  BETWEEN 1 AND 5),
  score_message    SMALLINT CHECK (score_message    BETWEEN 1 AND 5),
  score_cta        SMALLINT CHECK (score_cta        BETWEEN 1 AND 5),

  -- Overall: computed client-side or stored explicitly
  score_overall    NUMERIC(3,1) CHECK (score_overall BETWEEN 1 AND 5),

  -- Structured feedback tags
  strengths        TEXT[] DEFAULT '{}',
  improvements     TEXT[] DEFAULT '{}',

  -- Free-form notes
  notes            TEXT,

  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_eval_scorecards_creative
  ON eval_creative_scorecards (creative_id);
CREATE INDEX IF NOT EXISTS idx_eval_scorecards_campaign
  ON eval_creative_scorecards (campaign_id);
CREATE INDEX IF NOT EXISTS idx_eval_scorecards_campaign_creative
  ON eval_creative_scorecards (campaign_id, creative_id);
CREATE INDEX IF NOT EXISTS idx_eval_scorecards_reviewer
  ON eval_creative_scorecards (reviewer_id)
  WHERE reviewer_id IS NOT NULL;

COMMENT ON TABLE eval_creative_scorecards IS
  'Gold: creative director subjective reviews. Always scoped to a campaign + creative.';
COMMENT ON COLUMN eval_creative_scorecards.score_concept IS
  '1-5: Is the idea strong and original?';
COMMENT ON COLUMN eval_creative_scorecards.score_craft IS
  '1-5: Is the execution high quality?';
COMMENT ON COLUMN eval_creative_scorecards.score_brand_fit IS
  '1-5: Does it feel on-brand?';
COMMENT ON COLUMN eval_creative_scorecards.score_message IS
  '1-5: Is the message clear and compelling?';
COMMENT ON COLUMN eval_creative_scorecards.score_cta IS
  '1-5: Is there a clear call-to-action?';
COMMENT ON COLUMN eval_creative_scorecards.score_overall IS
  'Overall score (1-5). Typically the mean of non-null dimension scores.';
COMMENT ON COLUMN eval_creative_scorecards.strengths IS
  'Array of positive feedback tags, e.g. {''on-brand'', ''strong-hook''}';
COMMENT ON COLUMN eval_creative_scorecards.improvements IS
  'Array of improvement tags, e.g. {''weak-cta'', ''too-long''}';
