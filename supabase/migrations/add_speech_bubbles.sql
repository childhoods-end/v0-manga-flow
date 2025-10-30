-- Migration: Add speech_bubbles table for storing detected manga speech bubbles
-- This enables accurate font size calculation based on actual bubble boundaries

-- Create speech_bubbles table
CREATE TABLE IF NOT EXISTS speech_bubbles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  bbox JSONB NOT NULL,  -- {x, y, width, height} - bounding box of the bubble
  contour JSONB,         -- Optional polygon contour points [{x, y}, ...]
  score FLOAT DEFAULT 0, -- Detection confidence score (0-1)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add bubble_id foreign key to text_blocks table
ALTER TABLE text_blocks
ADD COLUMN IF NOT EXISTS bubble_id UUID REFERENCES speech_bubbles(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_speech_bubbles_page_id ON speech_bubbles(page_id);
CREATE INDEX IF NOT EXISTS idx_text_blocks_bubble_id ON text_blocks(bubble_id);

-- Add comments for documentation
COMMENT ON TABLE speech_bubbles IS 'Stores detected speech bubble regions from manga pages';
COMMENT ON COLUMN speech_bubbles.bbox IS 'Bounding box coordinates: {x, y, width, height}';
COMMENT ON COLUMN speech_bubbles.contour IS 'Polygon contour points for precise bubble shape';
COMMENT ON COLUMN speech_bubbles.score IS 'Detection confidence score from bubble detection algorithm';
COMMENT ON COLUMN text_blocks.bubble_id IS 'Reference to the speech bubble containing this text block';
