-- 010_add_meta_to_platform_type.sql
--
-- Adds 'meta' to the platform_type enum.
-- Uses IF NOT EXISTS so this is safe to re-run.

ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'meta';
