# Instruxa

<p align="center">
  <strong>Engineering-grade prompt infrastructure for serious AI builders.</strong>
</p>

<p align="center">
  Compile intent into structured prompts, execute securely across leading model providers, compare responses, and turn successful experiments into versioned AI assets.
</p>

<p align="center">
  <a href="https://still-darkness-9403.veerendra-kalyanbabu.workers.dev/"><strong>Launch Instruxa</strong></a>
  · <a href="docs/ARCHITECTURE.md">Architecture</a>
  · <a href="docs/ROADMAP.md">Roadmap</a>
  · <a href="SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="https://github.com/veerendrakalyanbabu-VKB/Instruxa/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/veerendrakalyanbabu-VKB/Instruxa/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827">
  <img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white">
  <img alt="D1" src="https://img.shields.io/badge/Database-Cloudflare_D1-F38020">
</p>

> [!IMPORTANT]
> Instruxa is an actively developed private-beta product. Authentication, saved projects, encrypted BYOK, Gemini execution, usage tracking, and the Response Lab foundation are implemented. Subscription billing and enterprise collaboration are not active.

## What Instruxa does

Instruxa treats prompts like production assets instead of disposable chat messages.

```mermaid
flowchart LR
    A["Describe intent"] --> B["Compile prompt"]
    B --> C["Run securely"]
    C --> D["Compare models"]
    D --> E["Evaluate quality"]
    E --> F["Version and ship"]
```

The compiler turns a goal, audience, tone, and model target into a complete instruction contract containing a role, objective, constraints, output format, validation criteria, and quality bar.

## Product capabilities

| Capability | Status |
|---|---|
| Structured prompt compiler | Available |
| Premium responsive workspace | Available |
| D1-backed accounts and secure sessions | Available |
| Private projects and immutable version snapshots | Available |
| OpenAI, Anthropic, and Gemini provider adapters | Available |
| AES-256-GCM encrypted bring-your-own keys | Available |
| Gemini Interactions API integration | Available |
| Token, latency, credit, and status tracking | Available |
| Automatic transient-provider retries | Available |
| Safe Markdown response rendering and export | Available |
| D1-backed Response Lab history | Migration 0003 |
| Deterministic response quality evaluation | Migration 0003 |
| Side-by-side connected-model comparison | Migration 0003 |
| Streaming responses | Planned |
| Teams, roles, approvals, and audit trails | Planned |
| Paid subscriptions and live billing | Planned |

## Response Lab

The Response Lab is the next stage of the product workflow:

- Persist successful runs to the authenticated user account
- Record provider, model, access mode, tokens, latency, and timestamp
- Score structure, completeness, actionability, and prompt-constraint fit
- Compare responses from connected providers side by side
- Reopen previous runs across sessions and devices
- Keep provider credentials outside response history

The first evaluator is intentionally deterministic and explainable. Model-assisted judges and reusable evaluation datasets remain roadmap items.

## Security architecture

- Passwords are salted and derived with PBKDF2-SHA-256 inside the Worker.
- Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, and backed by stored token digests.
- Provider keys are encrypted using AES-256-GCM before D1 persistence.
- The BYOK master key exists only as a Cloudflare Worker runtime secret.
- Provider keys are decrypted only for an authenticated request inside the Worker.
- All project, key, usage, and run-history queries are scoped to the authenticated user.
- API responses containing private data use `Cache-Control: no-store`.
- Provider overloads receive bounded retries with exponential backoff.
- Real credentials and private prompts must never be committed to the repository.

See [SECURITY.md](SECURITY.md) for reporting guidance and current limitations.

## Architecture

```mermaid
flowchart TD
    UI["React workspace"] --> API["Cloudflare Worker API"]
    API --> AUTH["Session and ownership checks"]
    API --> D1["Cloudflare D1"]
    API --> VAULT["AES-GCM BYOK vault"]
    VAULT --> GW["Provider gateway"]
    GW --> MODELS["OpenAI · Anthropic · Gemini"]
    GW --> RUNS["Usage and Response Lab records"]
    RUNS --> D1
```

| Layer | Technology |
|---|---|
| Interface | React 19, TypeScript, Tailwind CSS |
| Application structure | Next.js-compatible App Router |
| Edge runtime | Vinext on Cloudflare Workers |
| Persistence | Cloudflare D1 / SQLite |
| AI providers | OpenAI Responses, Anthropic Messages, Gemini Interactions |
| UI primitives | shadcn/ui, Lucide React |
| Quality | ESLint, TypeScript, GitHub Actions |

Detailed boundaries and data flows are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Local development

### Requirements

- Node.js 22.13 or newer
- npm
- A Cloudflare account for Worker and D1 integration

```bash
git clone https://github.com/veerendrakalyanbabu-VKB/Instruxa.git
cd Instruxa
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
npm test
```

## Cloudflare deployment

Create a D1 database named `instruxa` and bind it to the Worker as `DB`. Apply migrations in order:

```bash
npx wrangler d1 execute instruxa --remote --file=migrations/0001_accounts_projects.sql
npx wrangler d1 execute instruxa --remote --file=migrations/0002_ai_gateway.sql
npx wrangler d1 execute instruxa --remote --file=migrations/0003_response_lab.sql
```

Configure `BYOK_MASTER_KEY` as a Worker runtime secret. It must be valid Base64 that decodes to exactly 32 bytes. Optional platform-funded access uses:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

Never add provider credentials or the master key as repository files or plaintext build variables.

The connected Cloudflare build uses:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |

## Repository structure

| Path | Responsibility |
|---|---|
| `app/` | Product surface and design system |
| `components/` | Account, compiler, model runner, and UI components |
| `worker/` | Authentication, project API, encrypted model gateway |
| `migrations/` | Ordered D1 schema migrations |
| `docs/` | Architecture and roadmap |
| `tests/` | Behavioral and security-focused tests |
| `.github/workflows/` | Continuous integration |

## Engineering principles

1. Fail closed for authentication and ownership checks.
2. Keep credentials server-side and encrypted at rest.
3. Make metering and commercial state authoritative on the server.
4. Prefer explainable evaluation signals before opaque scoring.
5. Preserve a deterministic, zero-provider-cost compiler path.
6. Document implemented, partial, and planned capabilities honestly.
7. Optimize for accessibility, performance, reduced motion, and mobile use.

## Roadmap

The next product milestones are streaming execution, richer evaluation datasets, response synthesis, team workspaces, governance, and subscription entitlements. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

Instruxa is currently owner-led. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Security reports must follow [SECURITY.md](SECURITY.md) and must not be posted publicly.

## Ownership

Copyright © 2026 K. Veerendra Kalyan Babu. All rights reserved.

No license is granted for commercial reuse, redistribution, or derivative products without written permission.
