-- Add font_size column to text_blocks table
ALTER TABLE text_blocks
ADD COLUMN IF NOT EXISTS font_size INTEGER;

-- Add comment
COMMENT ON COLUMN text_blocks.font_size IS 'Estimated font size from OCR bounding box height';
