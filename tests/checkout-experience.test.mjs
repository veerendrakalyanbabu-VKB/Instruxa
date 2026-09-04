import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const billingUi = await readFile(new URL("../components/billing-center.tsx", import.meta.url), "utf8");
const billingWorker = await readFile(new URL("../worker/billing.ts", import.meta.url), "utf8");

test("checkout exposes progress and errors next to the pricing actions", () => {
  assert.match(billingUi, /Opening secure Stripe checkout/);
  assert.match(billingUi, /id="billing-status"/);
  assert.match(billingUi, /aria-live="polite"/);
  assert.match(billingUi, /Opening Stripe…/);
});

test("checkout accepts only Stripe-hosted redirect URLs", () => {
  assert.match(billingUi, /https:\/\/checkout\.stripe\.com\//);
});

test("checkout sessions carry a Stripe integration identifier", () => {
  assert.match(billingWorker, /integration_identifier: integrationIdentifier\(\)/);
  assert.match(billingWorker, /instruxa_/);
});
