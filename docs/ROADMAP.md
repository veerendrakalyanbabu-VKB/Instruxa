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

## M5 — Commercial launch · Active

- Server-authoritative Free, Pro, and Team entitlements
- Plan-aware project and generation-rate limits
- Stripe subscription checkout and customer portal
- Signed, replay-bounded, idempotent billing webhooks
- Explicit disabled/test/live safety modes
- Test/live credential and webhook isolation
- Checkout idempotency and duplicate-subscription prevention
- Paid-only credit-pack fulfillment
- One-time credit-pack checkout
- Immutable credit ledger and failed-run refunds
- Public pricing with account-aware conversion paths
- Functional Privacy, Terms, and Security routes
- Accessibility labels and truthful capability messaging

Remaining:

- Configure and verify the Stripe sandbox Customer Portal
- Complete Stripe test-mode checkout, renewal, cancellation, and refund verification
- Reconciliation and operator tooling
- Abuse monitoring and provider-cost guardrails
- Enterprise contracting and custom entitlements

## Public paid-launch gates

A paid launch requires:

- Email verification and account recovery
- CSRF review and session revocation controls
- Tenant-isolation tests
- Key-rotation and incident procedures
- Billing idempotency and reconciliation
- Automated migration verification
- Monitoring and alerting
- Qualified legal review of privacy, terms, billing, and data-retention policies
- Private-beta load and security testing
