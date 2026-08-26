# Changelog

All notable changes to this project are documented here, in the style of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project doesn't tag numbered releases yet, so entries are grouped by milestone date instead of version number.

For the full narrative behind each entry — the *why*, not just the *what* — see [`demo-app/docs/en/03-development/HISTORY.md`](demo-app/docs/en/03-development/HISTORY.md).

## [Unreleased]

### Added
- **Standalone repository.** The project now lives in its own repository containing `demo-app/` and `broker/` together, extracted from inside the cloned `Azure-Samples/AI-Gateway` working copy. The official lab was not copied, forked, or modified — it is an external prerequisite, referenced by URL.
- Bilingual root `README.md` / `README.es.md` as the repository entry point, covering what was built, what was not, the lab prerequisite, the request flow, how the copilot actually works, and cost guidance.

### Changed
- All lab-relative links (`../README.md`, `../main.bicep`, the notebook) replaced with verified links to [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway).
- References to consolidated design documents (`PROJECT_CONTEXT.md`, `DEMO_DESIGN.md`, `UI_BLUEPRINT.md`, `PRODUCT_ARCHITECTURE.md`, `AZURE_INTEGRATION.md`) rewritten to their current equivalents across 30 source files.
- `.env.example` files rewritten to match the variables the code actually reads, with placeholders only; the frontend example no longer describes the broker as unimplemented.
- Code comments stating the broker was "not yet implemented" corrected.

### Fixed
- **Simulation mode is no longer described as an offline demo.** The rehearsal-capture loader is not built and the service returns `PLACEHOLDER` values; documentation now says so plainly.
- Removed `npm run lint` from `demo-app/package.json` — there was no ESLint config or dependency, so it could only fail.

### Security
- The real resource-group name was replaced with `{resource-group}` across the documentation and **redacted from `01-landing.png` and `05-plataforma.png`**, where it appeared as rendered pixels and so survived every text-based sweep.

## Earlier — documentation and open-source preparation

### Added
- Bilingual documentation (`demo-app/docs/en/`, `docs/es/`), root community files (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ACKNOWLEDGEMENTS.md`, this file), and a top-level `assets/` folder for the README banner, the reused lab diagram, and screenshots.
- English-language primary `README.md`, with a Spanish mirror at `README.es.md`.

### Changed
- Documentation that previously lived scattered at the lab's repository root was consolidated entirely under `demo-app/docs/`, reviewed for accuracy against the current codebase, and had all real subscription/tenant/personal identifiers redacted before publication.
- Final pre-publication pass: both README files restructured with a linked table of contents, clickable badges, and an expanded "Why this project exists" section; a couple of stale status notes in `docs/` (an already-finished reorganization still described as "in progress") were corrected.

## 2026-08-04 — Console closed, agent lifecycle completed

### Added
- Delete-agent capability: a trash-can button next to "Create agent" in the Agents section, gated behind typing the exact agent name to confirm. Backed by a new `DELETE /api/agents/:name` broker route that cascades to every version Foundry has registered for that agent.
- A new entry in the in-app copilot's knowledge base so it never presents this console as a replacement for Azure AI Foundry or the Azure Portal, verified live in both English and Spanish.

### Fixed
- A misleading "still pending" message that could appear in the Observability section during genuine (permanent) failure states rather than transient ones.
- A duplicated scroll-region implementation in the Observability detail dialog, replaced with the shared `PanelBody` component.

### Changed
- All four top-level console sections — Agents, Gateway, Observability, Platform — audited end to end against a live Azure deployment (not just against design documents) and formally closed.

### Known issues (documented, intentionally not fixed)
- `AuditRecordSection.tsx` swallows a class of fetch errors silently instead of surfacing them — flagged as independent technical debt for a future task.
- The Observability detail dialog closes silently, with no error message, if the broker becomes unreachable while the dialog is open.

## 2026-08-03 — Repositioning and the guided walkthrough

### Changed
- **Product repositioning.** An earlier framing — "the dual-gateway pattern is the product" — was retired after a self-critical review found the console had been built around API Management when the lab it demonstrates is actually about Foundry Hosted Agents. The corrected framing: *"The product is the first sentence; the gateway is the second."*
- The single-dashboard layout was replaced with a five-stop guided walkthrough (Frameworks, Hosted Agents, API Management, Observability, Operations), one stop on stage at a time, in the order the lab itself builds.
- Chat stopped being the centerpiece and became a collapsible copilot available at every stop.
- Access Control and Policy were merged into the API Management stop; Controls was merged into Operations.

### Added
- A dedicated "Hosted Agents" stop reading the live Foundry registry: image digest, push timestamp, immutable version, resource allocation.

### Removed
- The session-metrics strip and its store plumbing, two KPI tiles that were labels rather than measurements, a duplicated copilot toolbar button, and roughly 29 orphaned i18n keys.

## 2026-08-02 — Executive observability verified live

### Verified
- Token counts corroborated by two independent sources: API Management's own LLM logs and the agent's own OpenTelemetry instrumentation.
- Per-hop gateway latency confirmed real: 1–5 ms of API Management overhead against 11–13 second end-to-end requests.
- End-to-end distributed tracing confirmed working — the response's `X-Request-ID` is literally Application Insights' `OperationId`.

## 2026-08-01 — Real Azure integration verified

### Added
- Every broker endpoint exercised against a live, deployed resource group with captured raw HTTP evidence (not just code review) — see [`demo-app/docs/en/03-development/AZURE_INTEGRATION_REPORT.md`](demo-app/docs/en/03-development/AZURE_INTEGRATION_REPORT.md).

### Fixed
- Two pre-existing factual errors discovered in the architecture documentation during this verification pass (an incorrect Bicep output count, among others) — corrected in the docs; no application code was affected.

## Initial build

### Added
- Initial frontend (`demo-app/`: React 19, TypeScript, Vite, Tailwind v4, Fluent UI v9, Zustand) and broker (`broker/`: Express, TypeScript, `DefaultAzureCredential`) scaffolding, wired end to end to a real Azure deployment of the official lab.
