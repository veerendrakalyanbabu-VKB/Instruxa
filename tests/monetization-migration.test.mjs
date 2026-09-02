import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../migrations/0005_monetization.sql", import.meta.url), "utf8");

test("monetization migration creates every authoritative billing table", () => {
  for (const table of ["subscriptions", "credit_ledger", "billing_events"]) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\s*\\(`, "i"));
  }
});

test("external billing references are unique and credit balances cannot be negative", () => {
  assert.match(sql, /UNIQUE\s*\(user_id,\s*reference_id\)/i);
  assert.match(sql, /balance_after INTEGER NOT NULL CHECK\s*\(balance_after >= 0\)/i);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription/i);
});

test("subscription and webhook state are constrained", () => {
  assert.match(sql, /CHECK\s*\(plan_id IN \('free','pro','team'\)\)/i);
  assert.match(sql, /CHECK\s*\(status IN \('processing','processed','failed'\)\)/i);
  assert.match(sql, /PRAGMA foreign_keys = ON/i);
});
