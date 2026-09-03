# Billing Operations Runbook

This runbook activates and verifies Instruxa billing without risking a real charge. Complete every test-mode gate before considering live mode.

## 1. Database gate

Apply `migrations/0005_monetization.sql`, then verify:

```sql
SELECT name
FROM sqlite_master
WHERE type = 'table'
  AND name IN ('subscriptions', 'credit_ledger', 'billing_events')
ORDER BY name;
```

Expected rows: `billing_events`, `credit_ledger`, and `subscriptions`.

## 2. Stripe test products

Create five Stripe test-mode Prices whose amounts match the public product catalog:

| Runtime variable | Type | Catalog amount |
|---|---|---:|
| `STRIPE_PRICE_PRO` | Monthly recurring | $19 |
| `STRIPE_PRICE_TEAM` | Monthly recurring | $49 |
| `STRIPE_PRICE_CREDITS_100` | One-time | $5 |
| `STRIPE_PRICE_CREDITS_500` | One-time | $20 |
| `STRIPE_PRICE_CREDITS_2000` | One-time | $60 |

Use actual `price_…` identifiers, not Product IDs or payment links.

## 3. Runtime configuration

The non-secret sandbox mode, canonical application URL, and Stripe Price IDs
are versioned in `vite.config.ts`. `keep_vars: true` prevents Wrangler from
discarding Dashboard-managed bindings during Git deployments.

Configure only sensitive values as encrypted Worker secrets, never plaintext
repository files:

- `STRIPE_SECRET_KEY=rk_test_…` as a secret (preferred least-privilege restricted key; `sk_test_…` is supported for initial sandbox verification)
- `STRIPE_WEBHOOK_SECRET=whsec_…` as a secret

The gateway fails closed when the mode is absent, a server key uses the wrong mode, or a Price ID is malformed.

## 4. Webhook endpoint

Endpoint: `POST /api/billing/webhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

The handler verifies Stripe HMAC signatures, enforces a five-minute replay window, rejects test/live mismatches, fingerprints payloads, and records idempotent processing state without storing full payment payloads.

## 5. Acceptance matrix

| Scenario | Expected result |
|---|---|
| Pro checkout | Test Checkout opens; one subscription is linked |
| Repeated checkout click | Stripe idempotency prevents duplicate sessions |
| Upgrade or downgrade | Existing subscribers are sent to Billing Portal |
| Initial successful subscription | Plan becomes active and its grant appears once |
| Monthly invoice replay | Only one renewal grant appears |
| Paid credit pack | Balance and ledger increase exactly once |
| Unpaid credit pack | No credits are granted |
| Subscription cancellation | Status updates; paid entitlement ends according to Stripe state |
| Invalid signature | HTTP 400; no commercial state changes |
| Wrong livemode | HTTP 400; no commercial state changes |
| Reused event ID with changed payload | HTTP 409; no commercial state changes |
| Missing billing configuration | Checkout and webhook fail closed with HTTP 503 |

## 6. Reconciliation queries

```sql
SELECT plan_id, status, COUNT(*) AS accounts
FROM subscriptions
GROUP BY plan_id, status
ORDER BY plan_id, status;

SELECT kind, SUM(amount) AS net_credits, COUNT(*) AS entries
FROM credit_ledger
GROUP BY kind
ORDER BY kind;

SELECT status, COUNT(*) AS events
FROM billing_events
GROUP BY status
ORDER BY status;
```

Investigate every failed event and any long-running `processing` event before enabling live mode. Stripe remains the payment authority; D1 remains the entitlement and credit authority used by Instruxa.

## 7. Live-mode gate

Live mode remains blocked until test checkout, portal changes, renewal, cancellation, refunds, webhook replay, D1 backup/restore, customer support, tax, invoice, and legal review are complete. Rotate away from all test secrets during the live cutover and verify the public disclosure changes to live checkout.
