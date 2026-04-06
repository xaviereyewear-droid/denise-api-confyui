-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 001: Create Jobs Table
-- ═══════════════════════════════════════════════════════════════════════════
-- Description: Initial schema for job persistence
-- Created: 2026-04-06

-- ═══════════════════════════════════════════════════════════════════════════
-- Jobs Table: Stores all job metadata and status
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jobs (
  -- Primary Key
  id TEXT PRIMARY KEY,

  -- Job Configuration
  workflow TEXT NOT NULL,  -- 'catalog' | 'portrait' | 'custom'
  status TEXT NOT NULL,    -- 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

  -- File Paths
  input_image_path TEXT NOT NULL,       -- Path to uploaded image
  output_image_path TEXT,                -- Path to result (null if not completed)

  -- ComfyUI Integration
  comfyui_prompt_id TEXT,                -- Prompt ID returned by ComfyUI
  progress INTEGER DEFAULT 0,            -- 0-100 progress percentage

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,

  -- Error Handling
  error_message TEXT,

  -- Metadata
  metadata JSON,  -- Store additional context if needed

  -- Constraints
  CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  CHECK (progress >= 0 AND progress <= 100)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indices for Performance
-- ═══════════════════════════════════════════════════════════════════════════

-- Query jobs by status (most common filter)
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- Query recent jobs
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Query incomplete jobs (for recovery on startup)
CREATE INDEX IF NOT EXISTS idx_jobs_incomplete ON jobs(status)
  WHERE status IN ('pending', 'queued', 'processing');

-- Query by workflow type
CREATE INDEX IF NOT EXISTS idx_jobs_workflow ON jobs(workflow);

-- ═══════════════════════════════════════════════════════════════════════════
-- Migrations Metadata Table
-- ═══════════════════════════════════════════════════════════════════════════
-- Tracks which migrations have been applied

CREATE TABLE IF NOT EXISTS migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration as applied
INSERT OR IGNORE INTO migrations (version, name) VALUES (1, '001_create_jobs_table');
