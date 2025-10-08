-- Translation jobs table for background task queue
CREATE TABLE IF NOT EXISTS translation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0, -- 0-100
  current_page INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_translation_jobs_project_id ON translation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_status ON translation_jobs(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_translation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS translation_jobs_updated_at ON translation_jobs;
CREATE TRIGGER translation_jobs_updated_at
  BEFORE UPDATE ON translation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_translation_jobs_updated_at();
