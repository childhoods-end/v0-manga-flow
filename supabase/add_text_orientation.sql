-- Add text_orientation column to text_blocks table
ALTER TABLE text_blocks
ADD COLUMN IF NOT EXISTS text_orientation TEXT DEFAULT 'horizontal';

-- Add comment
COMMENT ON COLUMN text_blocks.text_orientation IS 'Text direction: horizontal or vertical';

-- Add check constraint
ALTER TABLE text_blocks
ADD CONSTRAINT text_blocks_orientation_check
CHECK (text_orientation IN ('horizontal', 'vertical'));
