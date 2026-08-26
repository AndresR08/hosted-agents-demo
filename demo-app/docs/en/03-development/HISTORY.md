# Development history

Chronological, milestone-by-milestone history of this demo's development. Complements [`PROJECT_STATUS.md`](PROJECT_STATUS.md) (the snapshot of the current state) and [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) (the why behind each decision) — this document is the order in which everything happened.

## 1. Design phase (before writing code)

Five design documents written before touching `demo-app/` or `broker/`: project context, lab architecture, demo design (philosophy and honesty rules), UI blueprint, and presentation flow. This phase established the original thesis that "the dual-gateway pattern is the product" — a thesis that would later be revised (see item 6).

## 2. Initial implementation

`demo-app/` (React 19 · TypeScript · Vite · Tailwind v4 · Fluent UI v9 · Zustand) and `broker/` (Express/TS, 19 endpoints, authentication via `DefaultAzureCredential`/`az login`, three distinct token audiences, CORS pinned to `localhost:5173`) were built. During construction, two decisions from the original design were overridden on the presenter's explicit instruction: the single stacked-column layout became a two-column composition, and the single-turn "Ask" became a multi-turn conversational assistant.

## 3. Azure integration verification (2026-08-01)

Every broker endpoint was tested with `curl` against the real deployed resource group, capturing the raw HTTP response as evidence — not just a code read. Verified live: agent invocation (full round trip APIM → Foundry → APIM → `gpt-5-mini`), credential tests (real 200/401/401), policy XML read from ARM, Foundry registry and ACR digest, `ApiManagementGatewayLlmLog` telemetry and Application Insights traces, per-hop timing, and ARM environment. Full detail in [`AZURE_INTEGRATION_REPORT.md`](AZURE_INTEGRATION_REPORT.md).

## 4. Documentation consistency audit (2026-08-01)

The six design documents were reread against the real code, not against memory of what had been planned. Five were updated with "As built" / "Overridden" notes where the implementation had diverged from the original design; the sixth (project status) was already current and needed no changes. Two pre-existing factual errors were found and corrected in the architecture document (an incorrect Bicep output count, among others).

## 5. Executive observability (2026-08-02)

Confirmed that token counts are real and corroborated by two independent sources (APIM logs and the container's own OpenTelemetry instrumentation). Confirmed that per-hop timing is real — `TotalTime − BackendTime` gives 1–5 ms of APIM's own cost against 11–13 second requests. Confirmed that distributed tracing works end to end: `X-Request-ID` is literally Application Insights's `OperationId`, with 7–10 real spans crossing the Foundry runtime, the container, and APIM.

## 6. Product repositioning — Phase 1 (2026-08-03)

A real course correction, not just a wording tweak: a self-critique (`PRODUCT_POSITIONING_REVIEW`, now consolidated into [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) §2) found that the demo had been built around API Management when the lab's actual focus is Foundry Hosted Agents. The "dual-gateway pattern is the product" thesis was explicitly retired and replaced with "Foundry first, gateway second." Frameworks were promoted to protagonists, "Ask both" (asking both agents at once) was added, and Controls was merged into Operations.

## 7. Five-stop guided tour (2026-08-03)

The application stopped being a single-screen dashboard and became a tour of five sequential "stops" (Frameworks, Hosted Agents, API Management, Observability, Operations), one on stage at a time, in the order the lab itself is built. The "Hosted Agents" stop was added (the biggest gap against the lab up to that point), and Access Control and Policy were merged into API Management. Chat stopped being the protagonist and became a collapsible copilot available at every stop.

## 8. Visual pass (2026-08-03)

Pure UX adjustments, with no narrative or architecture changes: typographic hierarchy (one thing at 16px per surface), reading measure (content capped at 1200px), consolidating the provenance badge into a single location per stop, and layout tuning for 1366×768 screens.

## 9. Four-section console — Agents, Gateway, Observability, Platform (current session)

The five-stop tour evolved into a console with **four top-level sections** (`SectionNav`: Agents, Gateway, Observability, Platform), navigated by tabs instead of sequential advancement — Agents absorbed the old Frameworks and Hosted Agents stops into a single section with internal tabs (Overview, Versions, Run).

Each section was audited and closed independently, following the same process across all four: static audit first, then typecheck, then build, then live verification against real Azure, and code was only fixed once a real bug was demonstrated with evidence:

- **Agents** — closed, no code changes needed beyond minor cleanup during development itself.
- **Gateway** — audited, no bugs found.
- **Observability** — audited across three stories (audit record, session telemetry, detail dialog). One real bug was found and fixed (a misleading "pending" message shown in genuine failure scenarios). Two technical-debt items were left **intentionally unfixed** and documented:
  1. An error-handling pattern in `AuditRecordSection.tsx` that silently swallows errors — explicitly deferred to a separate future task.
  2. The Observability detail dialog closes silently if the broker fails while the dialog is open — reported, pending a decision.
- **Platform** — audited, no bugs demonstrated live (two initial suspicions about error handling turned out to be the same pattern already accepted in Gateway, not a new bug).

## 10. New feature: deleting agents (current session)

Added the ability to delete agents from the interface — a trash-can button next to the create-agent one, in the Agents section — with a confirmation requiring the user to type the exact agent name before proceeding. Implemented in the broker (`DELETE /api/agents/:name`, which cascades to all versions of the agent in Foundry) and the frontend. Verified live against real Azure: creating a disposable agent, blocking the confirmation button with a wrong name, successful deletion, and a subsequent retry confirming a correct 404.

## 11. Copilot positioning clarification (current session)

Added a new entry to the copilot's knowledge base (`broker/src/demoKnowledge.ts`) so the conversational assistant never presents this application as a replacement for Azure AI Foundry or the Azure Portal. Verified live, in both English and Spanish, against the real agent across the full API Management → Foundry → model path.

## 12. Documentation reorganization into Spanish

All of the demo's own documentation — previously scattered across the repository root, in English — was consolidated into `demo-app/docs/`, translated and organized into four thematic folders (`01-general/`, `02-presentacion/`, `03-desarrollo/`, `04-referencias/`). `demo-app/README.md` was rewritten in Spanish to reflect the current four-section console. The official lab `README.md`, at the repository root, was left untouched.

## 13. Bilingual restructuring for open-source publication

Documentation was restructured again to become bilingual: `docs/es/` (the previous milestone's content, moved as-is) and a new `docs/en/`, with all eleven documents translated into English with full technical fidelity. Standard open-source community files were added (`LICENSE` under the MIT License, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ACKNOWLEDGEMENTS.md`, `CHANGELOG.md`), along with an `assets/` folder holding a custom banner, a local copy of the official lab's architecture GIF (reused with attribution under its MIT License), and the screenshots. `README.md` became the primary English version, with `README.es.md` as its Spanish mirror. During this pass, real sensitive data still present in the technical documentation was found and anonymized (an email address, a subscription and tenant name, and an Azure resource suffix repeated across several documents).

## 14. Final review before publication

A last quality pass before publishing: the copyright placeholder in `LICENSE` was replaced, both README files were reviewed for structure, navigation, a linked table of contents, and an expanded "Why this project exists" section — checked to convey the same message in both languages without being a literal translation of each other — every link and image was re-verified, a couple of real inconsistencies found in `docs/` were fixed (status text that still said a completed reorganization was "in progress," and a mis-cited link label for the official repository), and the sensitive-data sweep was repeated, finding nothing new.

## See also

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — where everything stands, today.
- [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) — why each decision mentioned here was made.
- [`AZURE_INTEGRATION_REPORT.md`](AZURE_INTEGRATION_REPORT.md) — the detailed evidence behind item 3.
