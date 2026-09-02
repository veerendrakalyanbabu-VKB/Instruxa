import assert from "node:assert/strict";
import test from "node:test";
import {
  billingMode,
  stripeEventMatchesMode,
  stripeKeyMatchesMode,
  stripeRuntimeReady,
  validStripePriceId,
  verifyStripeSignature,
} from "../worker/billing-core.mjs";

test("billing is fail-closed unless a mode is explicit", () => {
  assert.equal(billingMode({}), "disabled");
  assert.equal(billingMode({ BILLING_MODE: "unexpected" }), "disabled");
  assert.equal(stripeRuntimeReady({ STRIPE_SECRET_KEY: "sk_test_example" }), false);
});

test("Stripe credentials must match the selected mode", () => {
  assert.equal(stripeKeyMatchesMode("sk_test_example", "test"), true);
  assert.equal(stripeKeyMatchesMode("sk_live_example", "test"), false);
  assert.equal(stripeKeyMatchesMode("sk_test_example", "live"), false);
  assert.equal(stripeKeyMatchesMode("sk_live_example", "live"), true);
});

test("checkout readiness requires a mode-compatible secret", () => {
  assert.equal(stripeRuntimeReady({ BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_test_example" }), true);
  assert.equal(stripeRuntimeReady({ BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_live_example" }), false);
  assert.equal(stripeRuntimeReady({ BILLING_MODE: "live", STRIPE_SECRET_KEY: "sk_live_example" }), true);
});

test("only Stripe Price IDs pass product validation", () => {
  assert.equal(validStripePriceId("price_1ExampleABC123"), true);
  assert.equal(validStripePriceId("prod_1ExampleABC123"), false);
  assert.equal(validStripePriceId("https://example.com"), false);
  assert.equal(validStripePriceId(undefined), false);
});

test("webhook livemode must match the configured runtime", () => {
  assert.equal(stripeEventMatchesMode({ livemode: false }, "test"), true);
  assert.equal(stripeEventMatchesMode({ livemode: true }, "test"), false);
  assert.equal(stripeEventMatchesMode({ livemode: true }, "live"), true);
  assert.equal(stripeEventMatchesMode({ livemode: false }, "live"), false);
  assert.equal(stripeEventMatchesMode({}, "disabled"), false);
});

test("webhook signatures are verified and replay bounded", async () => {
  const payload = JSON.stringify({ id: "evt_test", livemode: false });
  const secret = "whsec_instruxa_test";
  const timestamp = 1_800_000_000;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const signature = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");

  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000), true);
  assert.equal(await verifyStripeSignature(`${payload}x`, `t=${timestamp},v1=${signature}`, secret, timestamp * 1000), false);
  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, (timestamp + 301) * 1000), false);
});
