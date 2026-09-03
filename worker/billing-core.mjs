const stripePricePattern = /^price_[A-Za-z0-9]+$/;

/** Return the explicit commercial operating mode. Billing is disabled by default. */
export function billingMode(env) {
  return env.BILLING_MODE === "test" || env.BILLING_MODE === "live" ? env.BILLING_MODE : "disabled";
}

/** Prevent test credentials from being used in live mode, and vice versa. */
export function stripeKeyMatchesMode(secretKey, mode) {
  if (mode === "test") return typeof secretKey === "string" && /^(?:sk|rk)_test_/.test(secretKey);
  if (mode === "live") return typeof secretKey === "string" && /^(?:sk|rk)_live_/.test(secretKey);
  return false;
}

export function validStripePriceId(value) {
  return typeof value === "string" && stripePricePattern.test(value);
}

export function stripeRuntimeReady(env) {
  const mode = billingMode(env);
  return mode !== "disabled" && stripeKeyMatchesMode(env.STRIPE_SECRET_KEY, mode);
}

/** Stripe test events must never mutate a live ledger, or the inverse. */
export function stripeEventMatchesMode(event, mode) {
  if (mode === "test") return event?.livemode === false;
  if (mode === "live") return event?.livemode === true;
  return false;
}

function hexToBytes(hex) {
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], value => Number.parseInt(value, 16));
}

/** Verify Stripe's HMAC signature and reject payloads outside the replay window. */
export async function verifyStripeSignature(payload, signature, secret, nowMs = Date.now()) {
  if (!signature || !secret) return false;
  const parts = signature.split(",").map(part => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(nowMs / 1000 - timestampNumber) > 300 || !signatures.length) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signedPayload = new TextEncoder().encode(`${timestamp}.${payload}`);
  for (const candidate of signatures) {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) continue;
    if (await crypto.subtle.verify("HMAC", key, hexToBytes(candidate), signedPayload)) return true;
  }
  return false;
}
