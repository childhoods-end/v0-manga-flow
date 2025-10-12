-- Complete migration: Add new columns and reset for re-translation
-- Execute this in Supabase SQL Editor

-- Step 1: Add font_size column if not exists
ALTER TABLE text_blocks
ADD COLUMN IF NOT EXISTS font_size INTEGER;

COMMENT ON COLUMN text_blocks.font_size IS 'Estimated font size from OCR bounding box height';

-- Step 2: Add text_orientation column if not exists
ALTER TABLE text_blocks
ADD COLUMN IF NOT EXISTS text_orientation TEXT DEFAULT 'horizontal';

COMMENT ON COLUMN text_blocks.text_orientation IS 'Text direction: horizontal or vertical';

-- Step 3: Add check constraint (drop first if exists to avoid errors)
DO $$
BEGIN
    ALTER TABLE text_blocks DROP CONSTRAINT IF EXISTS text_blocks_orientation_check;
    ALTER TABLE text_blocks ADD CONSTRAINT text_blocks_orientation_check
    CHECK (text_orientation IN ('horizontal', 'vertical'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Step 4: Clear old translation data to force re-translation with new fields
-- This will delete all text_blocks and translation_jobs, allowing fresh translation
TRUNCATE TABLE text_blocks CASCADE;
TRUNCATE TABLE translation_jobs CASCADE;

-- Step 5: Reset all projects to pending status
UPDATE projects
SET status = 'pending', processed_pages = 0;

-- Verification: Check the new schema
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'text_blocks'
  AND column_name IN ('font_size', 'text_orientation')
ORDER BY column_name;
