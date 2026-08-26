# Contributing

Thanks for considering a contribution to this project. It started as an independent portfolio piece, but issues, corrections, and pull requests are genuinely welcome — especially anything that improves accuracy about the Azure architecture it visualizes.

## Before you start

This repository has one hard boundary: it is a **companion** to the official Microsoft lab ["AI Foundry Hosted Agents with Custom Frameworks"](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/ai-foundry-hosted-agents-custom-framework), not a fork of it. Contributions that would turn this into a replacement for Azure AI Foundry, the Azure Portal, or the official lab's own deployment tooling are out of scope — see [`demo-app/docs/en/01-general/PURPOSE.md`](demo-app/docs/en/01-general/PURPOSE.md) for why that line exists.

Everything in this repository under `demo-app/` is fair game. The official lab's own files (root `README.md`, the notebook, Bicep templates, policy XML, `src/`) live one directory above `demo-app/` and are not part of this project — issues about the lab itself belong in the [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway) repository, not here.

## Ways to contribute

- **Bug reports** — something in the console doesn't match what Azure actually reports, a broken link in the docs, a typo. Open an issue with steps to reproduce, or the file/line if it's a docs issue.
- **Documentation improvements** — this project keeps English and Spanish documentation in sync under `demo-app/docs/en/` and `docs/es/`. If you fix or improve one language, please mirror the change in the other, or flag in your PR that a follow-up translation is needed.
- **Feature contributions** — open an issue first to discuss scope before writing code. This keeps the console's four sections (Agents, Gateway, Observability, Platform) focused rather than growing into a general-purpose Azure dashboard.

## Development setup

See the [root README](README.md#getting-started) for prerequisites and how to run the console locally against a real (or your own) deployment of the official lab.

```bash
cd demo-app
npm install
npm run dev          # frontend, http://localhost:5173
npm run typecheck    # tsc -b --noEmit
npm run build         # tsc -b && vite build
```

The broker (`../broker`) has its own `npm install` / `npm run dev` — see the root README's setup steps.

## Code style

- TypeScript, strict mode. `npm run typecheck` must pass before a PR is reviewed.
- No new abstractions for a single call site — this codebase favors reading one file to understand one feature over indirection.
- Comments explain *why*, not *what* — see the existing code for the tone this project aims for.
- No secrets, real subscription IDs, tenant names, or personal identifiers in commits, screenshots, or documentation. If your PR includes a screenshot or example output from a real Azure deployment, redact anything that identifies a specific subscription or organization (a generic `{suffix}` placeholder is the existing convention — see any file under `demo-app/docs/en/03-development/`).

## Submitting a pull request

1. Fork the repository and branch from `main`.
2. Keep PRs focused — one concern per PR is easier to review and to revert if needed.
3. Run `npm run typecheck` and `npm run build` in `demo-app/` (and in `broker/` if you touched it) before opening the PR.
4. Describe *why* the change is needed, not just what changed — the same standard this project's own documentation holds itself to.

## Questions

Open an issue — there's no separate mailing list or chat for this project.
