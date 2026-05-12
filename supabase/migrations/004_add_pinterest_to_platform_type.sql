-- ============================================================
-- Migration: 004_add_pinterest_to_platform_type.sql
--
-- Adds 'pinterest' to the platform_type enum.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block,
-- so this uses a DO block to skip safely if the value already exists.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'platform_type'
      AND e.enumlabel = 'pinterest'
  ) THEN
    ALTER TYPE platform_type ADD VALUE 'pinterest';
  END IF;
END
$$;
