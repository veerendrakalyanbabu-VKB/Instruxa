import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "e5d4d8c7-85b6-4542-9678-b582cfe89673";
const D1_DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID ?? SITE_CREATOR_PLACEHOLDER_DATABASE_ID;

// Non-secret sandbox configuration is versioned so Git deployments cannot
// silently disable checkout. Stripe API and webhook secrets stay in Cloudflare.
const billingVars = {
  BILLING_MODE: "test",
  APP_URL: "https://still-darkness-9403.veerendra-kalyanbabu.workers.dev",
  STRIPE_PRICE_PRO: "price_1UBbUBPIUwjy41DwpqFlmrvd",
  STRIPE_PRICE_TEAM: "price_1UBbUtPIUwjy41DwxMbNDmct",
  STRIPE_PRICE_CREDITS_100: "price_1UBbVBPIUwjy41DwzhTLYIQf",
  STRIPE_PRICE_CREDITS_500: "price_1UBbUePIUwjy41DwQaB54FaL",
  STRIPE_PRICE_CREDITS_2000: "price_1UBbVUPIUwjy41Dwe6KkGwN6",
} as const;

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  name: "still-darkness-9403",
  main: "./worker/index.ts",
  keep_vars: true,
  vars: billingVars,
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "instruxa",
          database_id: D1_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
