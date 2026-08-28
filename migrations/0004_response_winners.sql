PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS response_winners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(user_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_response_winners_owner
  ON response_winners(user_id, created_at DESC);
