# Instruxa

### Engineering-grade prompts, built at the speed of thought.

[![Live](https://img.shields.io/badge/live-Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)](https://still-darkness-9403.veerendra-kalyanbabu.workers.dev/)
[![CI](https://github.com/veerendrakalyanbabu-VKB/Instruxa/actions/workflows/ci.yml/badge.svg)](https://github.com/veerendrakalyanbabu-VKB/Instruxa/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827)](https://react.dev/)

**[Launch Instruxa](https://still-darkness-9403.veerendra-kalyanbabu.workers.dev/)** · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Security](SECURITY.md)

Instruxa is a premium prompt-engineering workspace for developers, startups, and AI teams. It transforms rough intent into structured, reusable instructions with explicit roles, objectives, requirements, output contracts, and quality criteria.

> **MVP status:** The public release is an interactive front-end MVP with a deterministic prompt compiler. Authentication, live model calls, persistent projects, billing, and team collaboration are planned and are not represented as production-ready today.

## Why Instruxa

Prompts used in real products should not disappear into chat history. Instruxa is being designed to treat them as governed engineering assets: structured, versioned, evaluated, portable, and ready for collaboration.

## Available now

- Interactive structured prompt compiler
- Audience and response-style controls
- Universal, OpenAI, Claude, and Gemini target selection
- Developer and business quick-start templates
- Deterministic requirements and output-contract generation
- Prompt quality presentation and copy-ready export
- Responsive, accessible premium interface
- Cloudflare edge deployment
- Dedicated static export for Cloudflare Pages

## Product vision

- Prompt projects, folders, tags, search, and version history
- Live multi-provider generation and comparison
- Encrypted bring-your-own-key support
- Automated evaluations, regression suites, and quality gates
- Team workspaces, roles, approvals, and audit trails
- Metered credits and subscription entitlements
- API, SDK, CLI, and CI/CD integration

## Architecture

    User intent
        ↓
    Structured compiler
        ↓
    Model-aware prompt contract
        ↓
    Quality checks → Copy / Export

The current release runs entirely in the browser. The planned production architecture separates identity, prompt orchestration, model gateways, evaluation, usage metering, billing, and audit services. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Technology

| Layer | Technology |
|---|---|
| Interface | React 19, TypeScript |
| Application | Next.js-compatible App Router structure |
| Styling | Tailwind CSS, shadcn/ui primitives |
| Icons | Lucide React |
| Runtime | Vinext / Cloudflare Workers |
| Static distribution | Next.js static export |
| Quality | ESLint, TypeScript, GitHub Actions |

## Local development

Prerequisites: Node.js 22.13+ and npm.

    git clone https://github.com/veerendrakalyanbabu-VKB/Instruxa.git
    cd Instruxa
    npm ci
    npm run dev

Validation:

    npm run lint
    npm run build
    npm run build:pages

## Deployment

### Cloudflare Workers

The primary hosted MVP runs on Cloudflare Workers. Use the repository's validated Worker/Vinext build path.

### Cloudflare Pages static export

- Build command: `npm run build:pages`
- Output directory: `out`
- Node.js: `22.13.0`

## Repository map

| Path | Purpose |
|---|---|
| `app/` | Product interface and global design system |
| `components/ui/` | Reusable interface primitives |
| `lib/` | Shared utilities |
| `worker/` | Cloudflare runtime entry point |
| `docs/` | Architecture and product roadmap |
| `.github/workflows/` | Automated quality checks |

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Report vulnerabilities privately according to [SECURITY.md](SECURITY.md); do not publish sensitive reports in public issues.

## Ownership

Copyright 2026 K. Veerendra Kalyan Babu. All rights reserved. No license is granted for commercial reuse, redistribution, or derivative products without written permission.