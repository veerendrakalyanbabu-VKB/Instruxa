import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("Cloudflare deployments preserve Dashboard-managed secrets and bindings", () => {
  assert.match(config, /keep_vars:\\s*true/);
});

test("sandbox billing configuration is deployed from versioned source", () => {
  assert.match(config, /BILLING_MODE:\\s*"test"/);
  assert.match(config, /APP_URL:\\s*"https:\\/\\/still-darkness-9403\\.veerendra-kalyanbabu\\.workers\\.dev"/);
  assert.match(config, /STRIPE_PRICE_PRO:\\s*"price_[A-Za-z0-9]+"/);
  assert.match(config, /STRIPE_PRICE_TEAM:\\s*"price_[A-Za-z0-9]+"/);
  assert.equal(config.includes("STRIPE_SECRET_KEY:"), false);
  assert.equal(config.includes("STRIPE_WEBHOOK_SECRET:"), false);
});
