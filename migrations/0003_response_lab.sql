PRAGMA foreign_keys = ON;

-- Durable Response Lab records. Provider credentials remain encrypted separately
-- and are never copied into run history.
CREATE TABLE IF NOT EXISTS ai_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('openai','anthropic','gemini')),
  model TEXT NOT NULL,
  access_mode TEXT NOT NULL CHECK(access_mode IN ('included','byok')),
  prompt TEXT NOT NULL,
  response_text TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  evaluation_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_runs_owner_created
  ON ai_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_runs_owner_provider
  ON ai_runs(user_id, provider, created_at DESC);
