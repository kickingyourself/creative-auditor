-- 007_add_programmatic_ooh_tvc_to_platform_type.sql
--
-- Adds the remaining planned platform_type enum values.
-- Uses IF NOT EXISTS so this is safe to re-run.

ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'programmatic';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'ooh';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'tvc';
