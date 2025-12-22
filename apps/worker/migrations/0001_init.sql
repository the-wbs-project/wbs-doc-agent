-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('strict', 'best_judgment')),
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'running', 'completed', 'failed')),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_hash_sha256 TEXT NOT NULL,
  r2_upload_key TEXT NOT NULL,
  r2_artifacts_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  node_count INTEGER,
  inferred_count INTEGER,
  ambiguous_count INTEGER,
  coverage_ratio REAL,
  options TEXT,
  summary TEXT,
  error TEXT
);

-- Nodes table (composite PK: job_id + id since node IDs are only unique per job)
CREATE TABLE IF NOT EXISTS nodes (
  job_id TEXT NOT NULL,
  id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  wbs_level TEXT,
  metadata TEXT NOT NULL DEFAULT '[]',
  provenance TEXT NOT NULL,
  inferred INTEGER DEFAULT 0,
  warnings TEXT DEFAULT '[]',
  PRIMARY KEY (job_id, id),
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON artifacts(job_id);

