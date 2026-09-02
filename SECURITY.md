# Security Policy

## Supported version

Instruxa is an active private-beta product. Only the latest `main` deployment is supported.

## Reporting a vulnerability

Do not create a public issue for suspected vulnerabilities, exposed credentials, authentication bypasses, cross-account access, billing errors, or private-data exposure.

Report privately through the repository owner's GitHub contact channel. Include:

- Concise description and impact
- Affected route, component, or commit
- Safe reproduction steps
- Relevant request identifiers with secrets removed
- Suggested mitigation, if known

Never include real API keys, passwords, session cookies, private prompts, customer information, or destructive payloads.

## Implemented controls

- PBKDF2-SHA-256 password derivation with per-user random salts
- Random opaque sessions with stored SHA-256 token digests
- `HttpOnly`, `Secure`, `SameSite=Lax` cookies
- Authenticated and user-scoped project, key, usage, and run APIs
- AES-256-GCM encryption for provider keys
- Runtime-only BYOK master secret
- No provider-key return path to the browser
- Bounded prompt, key, and model inputs
- Per-user generation rate limiting
- Bounded retries for transient provider failures
- Failed-call included-credit refunds
- Server-authoritative plan and credit enforcement
- Stripe HMAC-SHA256 webhook verification with replay bounds
- Idempotent billing-event and credit-grant references
- No raw payment payload or card-data persistence
- `Cache-Control: no-store` on private JSON APIs
- Secrets excluded by `.gitignore`

## Current limitations

The private beta does not yet include email verification, password recovery, multi-factor authentication, organization RBAC, formal audit retention, automated key rotation, activated live subscription billing, or an external penetration test. The deterministic evaluator is not a factual-accuracy guarantee.

## Operator responsibilities

- Store `BYOK_MASTER_KEY` only as a Cloudflare Worker secret.
- Restrict Cloudflare and GitHub administrative access.
- Apply D1 migrations in order and test backups.
- Rotate secrets after suspected exposure.
- Never paste production secrets into issues, commits, screenshots, or build logs.
- Review provider data-processing settings before enabling platform-funded keys.
- Test Stripe checkout and signed webhook fulfillment in test mode before enabling live Price IDs.
- Reconcile Stripe invoices, subscriptions, and D1 credit grants before commercial launch.

## Response process

Reports will be acknowledged, triaged, reproduced safely, remediated, and disclosed after a fix when appropriate. No contractual response SLA applies during private beta.
