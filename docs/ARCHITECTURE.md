# Instruxa Architecture

## Current MVP

The current release is intentionally simple and deterministic. It is a client-side React experience that compiles user-provided intent, audience, style, and model target into a structured prompt contract. It does not send content to an external model or store user data.

## Current flow

1. The user describes the desired outcome.
2. Client state captures audience, response style, and model target.
3. A deterministic compiler assembles role, objective, requirements, output contract, and quality bar.
4. The interface presents quality metadata and copy-ready output.

## Planned production boundaries

| Boundary | Responsibility |
|---|---|
| Web application | Workspace, editor, projects, evaluations, billing UI |
| Identity service | Authentication, sessions, organizations, RBAC |
| Prompt service | Projects, versions, variables, templates, promotion state |
| Model gateway | Provider routing, encrypted BYOK, limits, retries, redaction |
| Evaluation service | Test datasets, judges, scoring, regression detection |
| Usage service | Token accounting, included credits, quotas, cost controls |
| Billing service | Plans, entitlements, invoices, webhook processing |
| Audit service | Immutable security and governance events |

## Security principles

- Provider keys must never be stored in browser-accessible state.
- Secrets must be encrypted at rest and decrypted only inside the model gateway.
- Plan and role enforcement must happen server-side.
- Billing webhooks must be signature-verified and idempotent.
- Prompt versions promoted to production must be immutable.
- Sensitive content must be redacted from logs and telemetry.
- Every organization-scoped query must enforce tenant isolation.

## Reliability principles

- Provider timeouts, retries, and circuit breakers
- Idempotency for billable and state-changing operations
- Versioned schemas and reversible migrations
- Rate limits at user, workspace, and provider levels
- Evaluation gates before prompt promotion
- Structured observability without prompt-content leakage

## Evolution

The static MVP can remain the marketing and onboarding surface while authenticated product routes progressively move behind server-backed services. Each milestone must preserve the deterministic compiler as a no-cost fallback and test fixture.