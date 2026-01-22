-- Fix nodes table to use composite primary key (job_id + id)
-- Node IDs are only unique within a job, not globally

DROP TABLE IF EXISTS nodes;

CREATE TABLE nodes (
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

