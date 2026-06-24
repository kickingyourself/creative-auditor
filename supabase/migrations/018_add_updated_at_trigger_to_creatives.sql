-- 018_add_updated_at_trigger_to_creatives.sql
--
-- Migration 013 defined fn_set_updated_at() and added the updated_at column
-- to creatives, but never attached the trigger to the table.
-- This migration closes that gap.

DROP TRIGGER IF EXISTS trg_creatives_updated_at ON creatives;

CREATE TRIGGER trg_creatives_updated_at
  BEFORE UPDATE ON creatives
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
