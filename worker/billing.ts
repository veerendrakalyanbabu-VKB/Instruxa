import { billingMode, runtimeValue, stripeEventMatchesMode, stripeKeyMatchesMode, stripeRuntimeReady, validStripePriceId, verifyStripeSignature } from "./billing-core.mjs";

export type BillingUser = { id: string; name: string; email: string };

export interface BillingEnv {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_TEAM?: string;
  STRIPE_PRICE_CREDITS_100?: string;
  STRIPE_PRICE_CREDITS_500?: string;
  STRIPE_PRICE_CREDITS_2000?: string;
  APP_URL?: string;
  BILLING_MODE?: "disabled" | "test" | "live";
}

type PlanId = "free" | "pro" | "team";
type StripeObject = Record<string, unknown> & { id?: string; metadata?: Record<string, string> };

export const planCatalog = {
  free: { id: "free", name: "Free", price: 0, monthlyCredits: 25, maxProjects: 3, requestsPerMinute: 10, comparisonModels: 2, features: ["25 starter credits", "Encrypted BYOK", "3 private projects", "Response quality scoring"] },
  pro: { id: "pro", name: "Pro", price: 19, monthlyCredits: 1000, maxProjects: 10000, requestsPerMinute: 30, comparisonModels: 3, features: ["1,000 credits every month", "Unlimited projects and versions", "3-model Response Lab", "Usage intelligence"] },
  team: { id: "team", name: "Team", price: 49, monthlyCredits: 5000, maxProjects: 10000, requestsPerMinute: 60, comparisonModels: 3, features: ["5,000 shared-ready credits", "Everything in Pro", "Higher execution limits", "Team workspace foundation"] },
} as const;

const creditPacks = [
  { id: "credits_100", credits: 100, price: 5, priceKey: "STRIPE_PRICE_CREDITS_100" },
  { id: "credits_500", credits: 500, price: 20, priceKey: "STRIPE_PRICE_CREDITS_500" },
  { id: "credits_2000", credits: 2000, price: 60, priceKey: "STRIPE_PRICE_CREDITS_2000" },
] as const;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const uid = () => crypto.randomUUID();
const safePlan = (value: unknown): PlanId => value === "pro" || value === "team" ? value : "free";
const stripeId = (value: unknown) => typeof value === "string" ? value : value && typeof value === "object" && "id" in value ? String((value as { id: unknown }).id) : null;
const unixDate = (value: unknown) => Number(value) > 0 ? new Date(Number(value) * 1000).toISOString() : null;
const sha256 = async (value: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
const integrationIdentifier = () => `instruxa_${Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => String.fromCharCode(97 + byte % 26)).join("")}`;

function publicCatalog(env: BillingEnv) {
  const ready = stripeRuntimeReady(env);
  const mode = billingMode(env);
  const key = runtimeValue(env.STRIPE_SECRET_KEY);
  return Object.values(planCatalog).map(plan => {
    if (plan.id === "free") return { ...plan, checkoutReady: true, checkoutIssue: null };
    const price = plan.id === "pro" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_TEAM;
    let checkoutIssue: string | null = null;
    if (mode === "disabled") checkoutIssue = "Set BILLING_MODE to test and deploy the latest Worker version.";
    else if (!key) checkoutIssue = "Add STRIPE_SECRET_KEY to the active Worker deployment.";
    else if (!stripeKeyMatchesMode(key, mode)) checkoutIssue = `Use a ${mode === "test" ? "sk_test_ or rk_test_" : "sk_live_ or rk_live_"} server key for ${mode} mode.`;
    else if (!validStripePriceId(price)) checkoutIssue = `Add a valid Stripe Price ID for ${plan.name} to the active Worker deployment.`;
    return { ...plan, checkoutReady: Boolean(ready && validStripePriceId(price)), checkoutIssue };
  });
}

export async function accountEntitlements(env: BillingEnv, userId: string) {
  try {
    const row = await env.DB.prepare("SELECT plan_id AS planId,status FROM subscriptions WHERE user_id=?").bind(userId).first<{ planId: PlanId; status: string }>();
    const active = row && ["active", "trialing"].includes(row.status);
    return planCatalog[active ? safePlan(row.planId) : "free"];
  } catch (error) {
    if (String(error).includes("no such table")) return planCatalog.free;
    throw error;
  }
}

async function creditBalance(env: BillingEnv, userId: string) {
  const row = await env.DB.prepare("SELECT balance FROM credit_accounts WHERE user_id=?").bind(userId).first<{ balance: number }>();
  return row?.balance ?? 25;
}

export async function consumeIncludedCredit(env: BillingEnv, userId: string, referenceId: string) {
  await env.DB.prepare("INSERT OR IGNORE INTO credit_accounts(user_id,balance) VALUES(?,25)").bind(userId).run();
  const charge = await env.DB.prepare("UPDATE credit_accounts SET balance=balance-1,updated_at=datetime('now') WHERE user_id=? AND balance>0").bind(userId).run();
  if (!charge.meta.changes) return false;
  try {
    const balance = await creditBalance(env, userId);
    await env.DB.prepare("INSERT INTO credit_ledger(id,user_id,amount,balance_after,kind,source,reference_id,note) VALUES(?,?,?,?,?,?,?,?)").bind(uid(), userId, -1, balance, "usage", "instruxa", `usage:${referenceId}`, "Included model execution").run();
  } catch (error) {
    if (!String(error).includes("no such table")) {
      await env.DB.prepare("UPDATE credit_accounts SET balance=balance+1,updated_at=datetime('now') WHERE user_id=?").bind(userId).run();
      throw error;
    }
  }
  return true;
}

export async function refundIncludedCredit(env: BillingEnv, userId: string, referenceId: string) {
  try {
    const refunded = await env.DB.prepare("SELECT id FROM credit_ledger WHERE user_id=? AND reference_id=?").bind(userId, `refund:${referenceId}`).first();
    if (refunded) return;
    await env.DB.prepare("UPDATE credit_accounts SET balance=balance+1,updated_at=datetime('now') WHERE user_id=?").bind(userId).run();
    const balance = await creditBalance(env, userId);
    await env.DB.prepare("INSERT INTO credit_ledger(id,user_id,amount,balance_after,kind,source,reference_id,note) VALUES(?,?,?,?,?,?,?,?)").bind(uid(), userId, 1, balance, "refund", "instruxa", `refund:${referenceId}`, "Failed execution refund").run();
  } catch (error) {
    if (String(error).includes("no such table")) await env.DB.prepare("UPDATE credit_accounts SET balance=balance+1,updated_at=datetime('now') WHERE user_id=?").bind(userId).run();
    else throw error;
  }
}

async function addCredits(env: BillingEnv, userId: string, amount: number, kind: "plan_grant" | "purchase" | "refund" | "adjustment", source: string, referenceId: string, note: string) {
  const existing = await env.DB.prepare("SELECT id FROM credit_ledger WHERE user_id=? AND reference_id=?").bind(userId, referenceId).first();
  if (existing) return false;
  await env.DB.prepare("INSERT OR IGNORE INTO credit_accounts(user_id,balance) VALUES(?,25)").bind(userId).run();
  await env.DB.prepare("UPDATE credit_accounts SET balance=balance+?,updated_at=datetime('now') WHERE user_id=?").bind(amount, userId).run();
  const balance = await creditBalance(env, userId);
  try {
    await env.DB.prepare("INSERT INTO credit_ledger(id,user_id,amount,balance_after,kind,source,reference_id,note) VALUES(?,?,?,?,?,?,?,?)").bind(uid(), userId, amount, balance, kind, source, referenceId, note).run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      await env.DB.prepare("UPDATE credit_accounts SET balance=MAX(0,balance-?),updated_at=datetime('now') WHERE user_id=?").bind(amount, userId).run();
      return false;
    }
    throw error;
  }
  return true;
}

function appOrigin(request: Request, env: BillingEnv) {
  const appUrl = runtimeValue(env.APP_URL);
  if (appUrl) {
    try { const configured = new URL(appUrl); if (configured.protocol === "https:") return configured.origin; } catch { /* use request origin */ }
  }
  return new URL(request.url).origin;
}

async function stripeRequest(env: BillingEnv, path: string, values: Record<string, string>, idempotencyKey?: string) {
  const secretKey = runtimeValue(env.STRIPE_SECRET_KEY);
  if (!stripeRuntimeReady(env) || !secretKey) throw new Error("BILLING_NOT_CONFIGURED");
  const body = new URLSearchParams(values);
  const headers: Record<string, string> = { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { method: "POST", headers, body });
  const data = await response.json() as Record<string, unknown> & { error?: { message?: string } };
  if (!response.ok) throw new Error(`STRIPE:${response.status}:${data.error?.message ?? "Stripe request failed."}`);
  return data;
}

export async function handleBillingApi(request: Request, env: BillingEnv, user: BillingUser): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/billing" && request.method === "GET") {
      let subscription: Record<string, unknown> = { planId: "free", status: "active", cancelAtPeriodEnd: false }, ledger: unknown[] = [], migrationRequired = false;
      try {
        const row = await env.DB.prepare("SELECT plan_id AS planId,status,current_period_start AS currentPeriodStart,current_period_end AS currentPeriodEnd,cancel_at_period_end AS cancelAtPeriodEnd,provider_customer_id AS customerId FROM subscriptions WHERE user_id=?").bind(user.id).first<Record<string, unknown>>();
        if (row) subscription = { ...row, cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd), customerId: undefined, canManage: Boolean(row.customerId && env.STRIPE_SECRET_KEY) };
        const rows = await env.DB.prepare("SELECT id,amount,balance_after AS balanceAfter,kind,source,note,created_at AS createdAt FROM credit_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.id).all();
        ledger = rows.results;
      } catch (error) {
        if (String(error).includes("no such table")) migrationRequired = true; else throw error;
      }
      const configured = stripeRuntimeReady(env);
      const packs = creditPacks.map(pack => ({ id: pack.id, credits: pack.credits, price: pack.price, checkoutReady: Boolean(configured && validStripePriceId(env[pack.priceKey])) }));
      return json({ subscription, entitlements: planCatalog[safePlan(subscription.planId)], credits: await creditBalance(env, user.id), plans: publicCatalog(env), creditPacks: packs, ledger, billingConfigured: configured, billingMode: billingMode(env), migrationRequired });
    }
    if (url.pathname === "/api/billing/checkout" && request.method === "POST") {
      const input = await request.json() as Record<string, unknown>;
      const kind = input.kind === "credits" ? "credits" : "subscription";
      const origin = appOrigin(request, env);
      let priceId = "", metadata: Record<string, string> = { user_id: user.id };
      if (kind === "subscription") {
        const plan = safePlan(input.planId);
        if (plan === "free") return json({ error: "Choose Pro or Team to open checkout." }, 400);
        priceId = runtimeValue(plan === "pro" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_TEAM);
        metadata = { ...metadata, kind: "subscription", plan_id: plan };
      } else {
        const pack = creditPacks.find(item => item.id === input.packId);
        if (!pack) return json({ error: "Choose a valid credit pack." }, 400);
        priceId = runtimeValue(env[pack.priceKey]);
        metadata = { ...metadata, kind: "credit_pack", credits: String(pack.credits), pack_id: pack.id };
      }
      if (!stripeRuntimeReady(env) || !validStripePriceId(priceId)) return json({ error: "Secure checkout is not configured for this product yet." }, 503);
      const existing = await env.DB.prepare("SELECT provider_customer_id AS customerId,provider_subscription_id AS subscriptionId,status FROM subscriptions WHERE user_id=?").bind(user.id).first<{ customerId: string | null; subscriptionId: string | null; status: string }>();
      if (kind === "subscription" && existing?.subscriptionId && ["active", "trialing", "past_due"].includes(existing.status)) return json({ error: "Use Manage billing to change an existing subscription safely." }, 409);
      const values: Record<string, string> = {
        mode: kind === "subscription" ? "subscription" : "payment",
        integration_identifier: integrationIdentifier(),
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/?billing=success#billing`,
        cancel_url: `${origin}/?billing=cancelled#billing`,
        client_reference_id: user.id,
        "metadata[user_id]": user.id,
        "metadata[kind]": metadata.kind,
      };
      for (const [key, value] of Object.entries(metadata)) values[`metadata[${key}]`] = value;
      if (kind === "subscription") for (const [key, value] of Object.entries(metadata)) values[`subscription_data[metadata][${key}]`] = value;
      if (existing?.customerId) values.customer = existing.customerId; else values.customer_email = user.email;
      const requestKey = request.headers.get("x-idempotency-key");
      const idempotencyKey = requestKey && /^[A-Za-z0-9_-]{16,120}$/.test(requestKey) ? `instruxa_${user.id}_${requestKey}` : undefined;
      const session = await stripeRequest(env, "checkout/sessions", values, idempotencyKey);
      if (typeof session.url !== "string" || !session.url.startsWith("https://checkout.stripe.com/")) throw new Error("STRIPE:502:Stripe returned an invalid checkout URL.");
      return json({ url: session.url });
    }
    if (url.pathname === "/api/billing/portal" && request.method === "POST") {
      const row = await env.DB.prepare("SELECT provider_customer_id AS customerId FROM subscriptions WHERE user_id=?").bind(user.id).first<{ customerId: string | null }>();
      if (!row?.customerId) return json({ error: "No billing account is connected yet." }, 400);
      const session = await stripeRequest(env, "billing_portal/sessions", { customer: row.customerId, return_url: `${appOrigin(request, env)}/#billing` });
      if (typeof session.url !== "string" || !session.url.startsWith("https://billing.stripe.com/")) throw new Error("STRIPE:502:Stripe returned an invalid billing portal URL.");
      return json({ url: session.url });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail === "BILLING_NOT_CONFIGURED") return json({ error: "Secure billing is not configured yet." }, 503);
    if (detail.startsWith("STRIPE:")) return json({ error: detail.split(":").slice(2).join(":") || "Stripe could not create the session." }, Number(detail.split(":")[1]) || 502);
    if (detail.includes("no such table")) return json({ error: "Apply migrations/0005_monetization.sql before activating billing." }, 503);
    console.error("Instruxa billing API", detail);
    return json({ error: "Billing request could not be completed." }, 500);
  }
}

async function upsertSubscription(env: BillingEnv, object: StripeObject) {
  const metadata = object.metadata ?? {};
  const userId = metadata.user_id || String(object.client_reference_id ?? "");
  if (!userId) return;
  const planId = safePlan(metadata.plan_id);
  const customerId = stripeId(object.customer);
  const subscriptionId = stripeId(object.subscription) ?? (String(object.object ?? "") === "subscription" ? object.id ?? null : null);
  const status = String(object.status ?? "active");
  const acceptedStatus = ["active", "trialing", "past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"].includes(status) ? status : "incomplete";
  await env.DB.prepare(`INSERT INTO subscriptions(user_id,plan_id,status,billing_provider,provider_customer_id,provider_subscription_id,current_period_start,current_period_end,cancel_at_period_end) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan_id=excluded.plan_id,status=excluded.status,billing_provider=excluded.billing_provider,provider_customer_id=COALESCE(excluded.provider_customer_id,subscriptions.provider_customer_id),provider_subscription_id=COALESCE(excluded.provider_subscription_id,subscriptions.provider_subscription_id),current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=datetime('now')`).bind(userId, planId, acceptedStatus, "stripe", customerId, subscriptionId, unixDate(object.current_period_start), unixDate(object.current_period_end), object.cancel_at_period_end ? 1 : 0).run();
  if (["active", "trialing"].includes(acceptedStatus) && planId !== "free" && subscriptionId) await addCredits(env, userId, planCatalog[planId].monthlyCredits, "plan_grant", "stripe", `subscription-start:${subscriptionId}`, `${planCatalog[planId].name} plan credit grant`);
}

async function linkCheckoutSubscription(env: BillingEnv, object: StripeObject) {
  const metadata = object.metadata ?? {};
  const userId = metadata.user_id || String(object.client_reference_id ?? "");
  const customerId = stripeId(object.customer);
  const subscriptionId = stripeId(object.subscription);
  if (!userId || !subscriptionId) return;
  const planId = safePlan(metadata.plan_id);
  await env.DB.prepare(`INSERT INTO subscriptions(user_id,plan_id,status,billing_provider,provider_customer_id,provider_subscription_id) VALUES(?,?,'incomplete','stripe',?,?) ON CONFLICT(user_id) DO UPDATE SET provider_customer_id=COALESCE(excluded.provider_customer_id,subscriptions.provider_customer_id),provider_subscription_id=COALESCE(excluded.provider_subscription_id,subscriptions.provider_subscription_id),updated_at=datetime('now')`).bind(userId, planId, customerId, subscriptionId).run();
}

async function processStripeEvent(env: BillingEnv, event: Record<string, unknown>) {
  const type = String(event.type ?? ""), data = event.data as { object?: StripeObject } | undefined, object = data?.object ?? {};
  if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
    const metadata = object.metadata ?? {}, userId = metadata.user_id || String(object.client_reference_id ?? "");
    if (metadata.kind === "credit_pack" && userId) {
      const credits = Number(metadata.credits);
      if (object.payment_status === "paid" && [100, 500, 2000].includes(credits)) await addCredits(env, userId, credits, "purchase", "stripe", `checkout:${object.id}`, `${credits} credit pack`);
    } else await linkCheckoutSubscription(env, object);
    return;
  }
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(type)) {
    await upsertSubscription(env, object);
    return;
  }
  if (type === "invoice.paid") {
    if (object.billing_reason === "subscription_create") return;
    const subscriptionId = stripeId(object.subscription) ?? stripeId((object.parent as Record<string, unknown> | undefined)?.subscription_details && ((object.parent as Record<string, unknown>).subscription_details as Record<string, unknown>).subscription);
    if (!subscriptionId || !object.id) return;
    const row = await env.DB.prepare("SELECT user_id AS userId,plan_id AS planId FROM subscriptions WHERE provider_subscription_id=?").bind(subscriptionId).first<{ userId: string; planId: PlanId }>();
    if (row && row.planId !== "free") await addCredits(env, row.userId, planCatalog[row.planId].monthlyCredits, "plan_grant", "stripe", `invoice:${object.id}`, `${planCatalog[row.planId].name} monthly credit renewal`);
  }
}

export async function handleBillingWebhook(request: Request, env: BillingEnv): Promise<Response> {
  const mode = billingMode(env);
  const webhookSecret = runtimeValue(env.STRIPE_WEBHOOK_SECRET);
  if (!stripeRuntimeReady(env) || !webhookSecret) return json({ error: "Billing webhook is not configured." }, 503);
  const payload = await request.text();
  if (!await verifyStripeSignature(payload, request.headers.get("stripe-signature"), webhookSecret)) return json({ error: "Invalid webhook signature." }, 400);
  let event: Record<string, unknown>;
  try { event = JSON.parse(payload) as Record<string, unknown>; } catch { return json({ error: "Invalid webhook payload." }, 400); }
  if (!stripeEventMatchesMode(event, mode)) return json({ error: "Webhook mode does not match the configured billing mode." }, 400);
  const eventId = String(event.id ?? ""), eventType = String(event.type ?? "unknown");
  if (!eventId) return json({ error: "Webhook event ID is required." }, 400);
  const hash = await sha256(payload);
  const existing = await env.DB.prepare("SELECT status,payload_hash AS payloadHash,created_at AS createdAt FROM billing_events WHERE id=?").bind(eventId).first<{ status: string; payloadHash: string; createdAt: string }>();
  if (existing && existing.payloadHash !== hash) return json({ error: "Webhook event payload mismatch." }, 409);
  if (existing?.status === "processed") return json({ received: true, duplicate: true });
  if (existing?.status === "processing" && Date.now() - Date.parse(existing.createdAt) < 300_000) return json({ received: true, duplicate: true });
  await env.DB.prepare(`INSERT INTO billing_events(id,provider,event_type,payload_hash,status) VALUES(?,?,?,?, 'processing') ON CONFLICT(id) DO UPDATE SET status='processing',error_code=NULL`).bind(eventId, "stripe", eventType, hash).run();
  try {
    await processStripeEvent(env, event);
    await env.DB.prepare("UPDATE billing_events SET status='processed',processed_at=datetime('now') WHERE id=?").bind(eventId).run();
    return json({ received: true });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 160) : "WEBHOOK_PROCESSING_FAILED";
    await env.DB.prepare("UPDATE billing_events SET status='failed',error_code=? WHERE id=?").bind(code, eventId).run();
    console.error("Instruxa Stripe webhook", code);
    return json({ error: "Webhook processing failed." }, 500);
  }
}
