# Product Roadmap

This roadmap is directional. Implemented, active, and planned work are separated to avoid overstating product readiness.

## M0 — Prompt compiler · Complete

- Premium responsive interface
- Deterministic structured prompt compiler
- Audience, tone, and model targeting
- Quick-start templates
- Markdown copy and export
- Cloudflare Worker deployment

## M1 — Account cloud · Complete

- D1-backed registration and sign-in
- Secure opaque cookie sessions
- Private prompt projects
- Immutable project-version snapshots
- User-scoped project APIs

## M2 — Secure model gateway · Complete

- OpenAI Responses adapter
- Anthropic Messages adapter
- Gemini Interactions adapter
- AES-256-GCM encrypted BYOK storage
- Provider-aware model selection
- Included-credit foundation
- Token, latency, and status metering
- Automatic bounded retries

## M3 — Response Lab · Active

- D1-backed run history
- Deterministic response evaluation
- Side-by-side connected-model comparison
- Quality, latency, and token presentation
- Safe Markdown rendering
- Response export
- Real provider response streaming
- Persistent response winner selection
- Best-response synthesis
- Authenticated usage and intelligence dashboard
- Provider, model, token, latency, quality, and winner analytics

Remaining:

- Reusable evaluation datasets
- Model-assisted judges
- Regression tests and quality gates
- Prompt-to-run traceability by project and version

## M4 — Teams and governance · Planned

- Organization workspaces
- Invitations and role-based access
- Shared prompt registry
- Comments and review requests
- Approval and promotion workflows
- Audit events and retention controls

## M5 — Commercial launch · Planned

- Server-authoritative plan entitlements
- Free, Pro, Team, and Enterprise limits
- Subscription checkout and customer portal
- Signed, idempotent billing webhooks
- Credit purchases and provider-cost controls
- Abuse monitoring and operational analytics

## Public paid-launch gates

A paid launch requires:

- Email verification and account recovery
- CSRF review and session revocation controls
- Tenant-isolation tests
- Key-rotation and incident procedures
- Billing idempotency and reconciliation
- Automated migration verification
- Monitoring and alerting
- Privacy policy, terms, and data-retention policy
- Private-beta load and security testing
