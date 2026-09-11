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

## 15. Presenter-brand mark in the rail footer (2026-09-07)

Added the "Controles Empresariales" mark to the navigation rail, at the
presenter's request, placed subtly rather than reopening the console's own
brand lockup. Only the geometric mark was used — the wordmark's dark navy has
no contrast against the rail's fixed dark ground in either theme — matted
against transparency and placed in the rail footer below the
copilot/home/settings icons, wrapping rather than truncating. All nine stage
screens were re-measured at 1366×768 before and after: identical
content/budget/hidden numbers in every deterministic case, confirming the
shared-chrome change did not reopen the 0px-hidden-content budget §4.8/§4.9/
§4.11 document. Verified live against the production deployment (real
`/api/health`, the built bundle's own fingerprint, and screenshots) after a
code-only redeploy that touched neither infrastructure, agent images, nor
agent registration. Full technical detail in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) §4.12.

## 16. The rail took a second palette, and the mark moved to the top of it (2026-09-10)

A palette and a logo file were supplied from a reference mockup belonging to
another project, with the instruction to take the visual language and nothing
structural. The rail's ground, ink, hover and border became the supplied
values; the active section became pink and "live" became indigo, splitting a
single borrowed `--color-accent` into two rail-scoped tokens that say two
different things. The presenter's mark moved from the rail footer to the brand
block at the top; the attribution line stayed in the footer, because a crimson
mark alone beside "Microsoft Foundry Hosted Agents" reads as a claim of
authorship and the words are what prevent it.

The pink lasted one commit. Promoting the mark had put the presenter's crimson
40px above the nav list, and the two are the same hue — 15.9° apart, ΔE2000
10.3. The active section moved to the indigo, 77.8° and ΔE2000 38.0 away, and
the pink tokens were deleted. Worth carrying forward from that: the collision
was first reported as a 1.17:1 contrast ratio, which is the wrong instrument —
WCAG contrast measures luminance and is blind to hue, and crimson against
indigo measures 1.17:1 too. Two colours that are hard to tell apart are not
the same finding as two colours that are the same colour.

Three things are worth carrying forward. The mockup painted "healthy/live"
green and that did not come across — `affirm` is still exactly one use, the
401, confirmed by a before/after census rather than by assertion. One supplied
value failed its own contrast check (`#4f46e5` at 2.87:1 on the rail ground)
and is used lifted to `#7b74ec` for the two marks that sit on that ground —
the second time a mockup palette has needed correcting for a projector. And
the nine stage screens were re-measured in both rail states and both modes,
once per cut: 64 measurements across two passes, all identical to the
baseline and to each other. Full technical detail in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) §4.13.

Found while measuring, unrelated to the change and more consequential than it:
the lab resource group `lab-hosted-agents-demo` no longer exists, so Live mode
has no backend and the credential test cannot run. See
[`PROJECT_STATUS.md`](PROJECT_STATUS.md) §4e.

## 17. The pink came back — the collision was the lockup's size, not its hue (2026-09-10)

Item 16's fix held for one round trip. The presenter supplied a screenshot of
the actual deployed application this palette comes from, running the same
crimson mark and the same pink active item a real 30px apart and reading
fine — a materially better source than the static HTML this project had
audited before. The active item moved back to pink.

What had actually been wrong was never the hue pairing; it was that the brand
block above it was a 150px stacked lockup — a 38px mark over a two-line name
over a four-line tagline — giving the crimson enough size and proximity to
compete with the pink pill 20px below it. The reference's own lockup is 34px
tall, symbol and name in one row, and the nav list starts 30px after it. The
brand block was resized and reflowed to match those measurements; the
tagline, which is real positioning copy and not decoration, moved to the rail
footer rather than being cut, mirroring where the reference keeps its own
line. The fix that held was proportion, not colour.

Re-measured a third time: 32 measurements, identical to the original
baseline and to both prior cuts. Full detail in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) §4.14.

## 18. Two real investigations on the `-v2` deployment: a missing permission, and latency's actual shape (2026-09-11)

**Permissions.** Two Settings → Maintenance actions 403'd. Traced to the same
shape as item 16/17's own root cause one level down: the App Service's
managed identity is new whenever the App Service is recreated, and the Reader
grant on the shared APIM (documented in `DESIGN_DECISIONS.md`, 2026-09-07)
was applied by hand once, against the *old* identity, never encoded into
`deploy.ps1`. Confirmed directly against Azure — zero assignments for the
current identity on the shared APIM, the old identity's grant still present
and orphaned — then fixed with the identical narrow grant, reapplied, and
verified with real clicks against the live console (both actions `200`,
real data, immediately after).

**Latency.** "8–17 s measured" had been a range since the risk register was
first written. Three real invocations, cross-checked against two independent
telemetry sources, gave it a shape: 6.4–7.3 seconds of fixed cost *before*
the agent's own instrumented span even starts — present identically whether
the reply is one word or several paragraphs, which is what marks it fixed
rather than proportional — followed by a model call that scales correctly
with response length (1.98 s → 8.34 s). The fixed part sits upstream of
everything this repository's code touches; nothing here can see inside it,
which is itself a finding worth having on record before anyone reaches for a
code-side fix that cannot reach the actual cost. Diagnosis only — no code,
sizing, or warm-up cadence changed.

Full detail for both in [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) and
[`PROJECT_STATUS.md`](PROJECT_STATUS.md) §4f/§4g.

## 19. The shared-APIM grant is now automated, not just reapplied (2026-09-11)

Item 18 fixed the live symptom and named what it left open: the grant was
manual, once, and the automation had no step for it. Closed the same day —
`Grant-DemoAppServiceRoles` grants it now, as a fifth role alongside the four
it already made, so the next App Service recreation does not lose it again.

The one real decision in an otherwise mechanical change: not building it on
`Grant-RoleIfMissing`, the helper the other four grants already use
successfully. The shared-APIM scope is exactly where item 18's own
`MissingSubscription` finding lives — folding the new grant into the existing
helper unmodified would have made a full, unflagged `deploy.ps1` run throw on
this exact step in this exact environment. `Grant-RoleIfMissingRest`, a
parallel function with the identical contract over `az rest`, avoids that
without touching the three call sites that have never shown the problem.

Verified three ways against the live `-v2` deployment rather than assumed
from a clean `-ValidateOnly` run (which doesn't reach this code at all): a
direct call to the updated function reported all five grants `(already
granted)`, and the create branch itself was exercised against a real,
harmless principal — a role assignment actually created, confirmed present,
then deleted and reconfirmed gone. No residue left behind.

## See also

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — where everything stands, today.
- [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) — why each decision mentioned here was made.
- [`AZURE_INTEGRATION_REPORT.md`](AZURE_INTEGRATION_REPORT.md) — the detailed evidence behind item 3.
