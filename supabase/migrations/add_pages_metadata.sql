-- Add metadata column to pages table for storing error details and timing data
ALTER TABLE pages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for faster metadata queries
CREATE INDEX IF NOT EXISTS idx_pages_metadata ON pages USING gin(metadata);

-- Add comment
COMMENT ON COLUMN pages.metadata IS 'Stores error details, stage timing, and other diagnostic information';
