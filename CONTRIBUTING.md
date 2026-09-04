# Contributing

Thank you for your interest in Instruxa. The project is currently owner-led and its source code is available under the [Elastic License 2.0](LICENSE).

## Before opening a pull request

1. Open or reference an issue describing the problem and intended outcome.
2. Keep the change narrowly scoped.
3. Do not add dependencies without explaining their security, performance, and maintenance impact.
4. Never commit credentials, tokens, private prompts, customer data, build output, or local environment files.

## Development

    npm ci
    npm run dev

Before submitting:

    npm run lint
    npm run build
    npm run build:pages

## Pull requests

- Use a clear imperative title.
- Explain behavior changes and tradeoffs.
- Include screenshots for visible interface changes.
- Add or update tests when behavior changes.
- Update documentation when architecture or setup changes.
- Confirm keyboard, mobile, reduced-motion, and error states for UI work.

## Contribution licensing

Unless a separate written agreement applies, a contribution accepted into this repository is made available under the Elastic License 2.0. By submitting a contribution, you represent that you have the right to provide it on those terms. Copyright ownership is not transferred merely by submitting a contribution.

Material contributions may require a separate contributor agreement before acceptance. Acceptance remains at the owner's discretion.