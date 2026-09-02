PRAGMA foreign_keys = ON;

-- One durable subscription record per account. Stripe identifiers remain
-- server-side and are never exposed as secrets.
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free' CHECK(plan_id IN ('free','pro','team')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','trialing','past_due','canceled','incomplete','incomplete_expired','unpaid','paused')),
  billing_provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK(cancel_at_period_end IN (0,1)),
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON subscriptions(provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription
  ON subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- Immutable balance history for grants, purchases, consumption refunds, and
-- operator adjustments. reference_id makes external events idempotent.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
  kind TEXT NOT NULL CHECK(kind IN ('plan_grant','purchase','usage','refund','adjustment')),
  source TEXT NOT NULL,
  reference_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(user_id, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_owner_created
  ON credit_ledger(user_id, created_at DESC);

-- Webhook receipt log prevents duplicate fulfillment without retaining full
-- payment payloads or sensitive card data.
CREATE TABLE IF NOT EXISTS billing_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processing','processed','failed')),
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_billing_events_created
  ON billing_events(created_at DESC);
