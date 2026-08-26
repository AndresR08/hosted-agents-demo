# Project status

A point-in-time snapshot of the presenter application's work on this lab, last updated 2026-08-03 and later supplemented with facts verified in subsequent sessions; it should keep being updated at every future milestone rather than being left as a frozen snapshot.

| | |
|---|---|
| **Last update (base document)** | 2026-08-03 |
| **Latest milestone (base document)** | **Visual pass.** Typographic hierarchy, reading measure, and spacing were reworked for a customer-facing run. No narrative, architecture, or panel changes |
| **Deployment** | `{resource-group}` · `swedencentral` · suffix `{suffix}` |
| **Demo readiness (as of 2026-08-03)** | **Full script on real data.** Both agents live. **Never seen in a browser** and never timed against a clock |
| **Product authority** | The product experience architecture document. Phase 1 was complete; this milestone delivered parts of Phase 2 (2.2, 2.3, 2.9) and items 1, 2, and 5 of its §11 acceptance test |

---

## 0. Repository extraction (2026-08-10)

The project was extracted from inside the cloned `Azure-Samples/AI-Gateway` working copy into its **own standalone repository**, containing `demo-app/` and `broker/` together plus the community files and `assets/` at the root. The official Microsoft lab was **not** copied, forked, or modified — it remains an external prerequisite, now referenced only by URL.

Changes made in this pass:

- Every lab-relative link (`../README.md`, `../main.bicep`, the notebook) replaced with verified links to `Azure-Samples/AI-Gateway`.
- Stale references to consolidated design documents (`PROJECT_CONTEXT.md`, `DEMO_DESIGN.md`, `UI_BLUEPRINT.md`, `PRODUCT_ARCHITECTURE.md`, `AZURE_INTEGRATION.md`) rewritten to their current equivalents across 30 source files. Section numbers were dropped rather than guessed at.
- New bilingual root `README.md` / `README.es.md` as the repository's entry point; the former `demo-app/README.md` pair was superseded and removed.
- Code comments claiming the broker was "not yet implemented" corrected — it has existed since the integration milestone.
- **Simulation mode documented honestly.** Public documentation previously described it as an offline safety net. It is not: the rehearsal-capture loader is unbuilt and the service returns `PLACEHOLDER` values.
- `npm run lint` removed from `demo-app/package.json` — there was no ESLint config and no ESLint dependency, so the script could only ever fail.
- `.env.example` files rewritten against the variables the code actually reads; placeholders only.
- Security sweep: the real resource-group name was replaced with `{resource-group}` throughout the documentation **and redacted from two screenshots** (`01-landing.png`, `05-plataforma.png`), where it was visible as rendered pixels and therefore invisible to grep.

Verified from a simulated clean clone (128 tracked files): `npm ci` + `typecheck` + `build` pass for `demo-app`, `npm ci` + `typecheck` pass for `broker`. `CLAUDE.md`, `.env`, `node_modules/`, `dist/`, and `*.tsbuildinfo` are all confirmed git-ignored.

---

## 1. Completed work (as of 2026-08-03)

- **Design phase (5 documents).** Project context · Architecture · Demo design (its §3 governs everything the application is allowed to claim) · UI Blueprint · Presentation Flow.
- **Frontend `demo-app/`** — React 19 · TypeScript · Vite · Tailwind v4 · Fluent UI v9 · Zustand. **Broker `broker/`** — Express/TS, 19 endpoints, `DefaultAzureCredential` → `az login`, three token audiences, CORS pinned to `localhost:5173`.
- **Real wiring to Azure**, verified endpoint by endpoint with captured HTTP in the [Azure Integration Report](AZURE_INTEGRATION_REPORT.md). Live: agent invocation (full round trip APIM → Foundry → APIM → `gpt-5-mini`) · credential tests (real 200/401/401 + real policy XML from ARM) · Foundry registry + ACR digest · `ApiManagementGatewayLlmLog` + App Insights traces · per-hop timing from `ApiManagementGatewayLogs` · ARM environment. Partial: controls (6/7; RBAC documented but not verified).
- **Executive observability (2026-08-02).** Tokens are real and corroborated by two independent sources. Per-hop timing is real: `TotalTime − BackendTime` gives APIM's own cost, **1–5 ms against 11–13 s requests**. Distributed tracing works — `X-Request-ID` *is* App Insights's `OperationId`; 7–10 real spans across the Foundry runtime, the container, and APIM.
- **Phase 1 — repositioned around the lab (2026-08-03).** Renamed to lead with Foundry; frameworks were promoted to protagonists; "Ask both" was added; provenance was marked on every response; Controls was merged into Operations; the Responses protocol was named; the "dual-gateway... *is the product*" thesis was retired from §3 of the project context, with a revision note.
- **Guided tour (2026-08-03, this milestone).** The application stopped being a dashboard.
  - **Five stops, one on stage at a time**, in the lab's own build order — Frameworks · Hosted Agents · API Management · Observability · Operations — with a rail keeping the whole route visible. Arrow keys or the rail advance through it; `C` toggles the copilot.
  - **Chat stopped being the protagonist.** It's now a collapsible copilot, available at every stop, `display:none` when closed so it costs no layout, and it keeps its history across closures. It's still a genuinely live call, still marked with framework/container/version.
  - **One panel, one question — structurally enforced.** Every stop renders through `StopFrame`, which reads exactly one `stop.<id>.question` key.
  - **② Hosted Agents is new** and closes the biggest gap against the lab: the notebook's own chain — source → `az acr build` → image + digest + push time → `create_version` → immutable version → running — with the resource envelope and environment variable keys, all read live from Foundry and ACR.
  - **③ API Management shows the routed URL**, with `{agentName}` highlighted. The broker builds it with the same function it uses to *call* an agent, so the URL on screen can't drift from the URL actually requested. Credential tests and the live policy were merged in here.
  - **Observability and Operations were split** out of the old tabbed panel — the evidence for a single request is a different question from what a platform team administers.
  - **Removed:** the session-metrics strip and its store plumbing · two KPI tiles that were labels, not measurements · three copilot toolbar buttons (one was a literal duplicate) · `SectionLabel` · ~29 orphaned i18n keys. EN/ES verified identical key by key (454 each).
  - **Copilot knowledge base expanded** to cover the lab and the notebook — registering an agent, adding a framework, how observability is obtained, how to run the guided tour, and the new stops.
  - `npm run typecheck` + `npm run build` passed in `demo-app/`; `npm run typecheck` passed in `broker/`.
- **Visual pass (2026-08-03, this milestone).** UX-only — no narrative, architecture, or panel changes.
  - **Typographic hierarchy.** The scale has four sizes (32/24/16/13), and nearly everything defaulted to 13px, so a stop now occupying the whole stage had no internal hierarchy. Every surface promotes exactly one thing to 16px — the framework positioning line, the step title, the audit record, the control name, the copilot's answer — and 13px went back to its job: labels and metadata.
  - **Reading measure.** Content is capped at 1200px and centered within the card, the shell at 1600px; header, body, and footer share the same left margin. Without this, text ran ~200 characters per line at 1920, and the application read like a stretched webpage.
  - **Provenance now lives in one place** — bottom-right of every stop, via a `StopFrame` prop. It used to be scattered across three different locations, and one stop rendered it twice.
  - **Removed:** the floating copilot button (it competed with the guided tour and overlapped the stop's footer) — the toggle is now header chrome; the redundant framework badge in ②; the dead `elevated` variant of `Surface`; the header's fourth info cluster (mode was merged into the environment line). **Fixed:** `divide-y` on a two-column grid was drawing separators between side-by-side cells in the Operations console.
  - **Shared `EmptyState` and `Skeleton`** so the three empty states and three loading states stopped being three different treatments of the same condition.
  - **1366×768 fit:** the three credential outcomes went from stacked to a single row (~96px reclaimed); the audit record to two columns; convergence to three; prompt/completion trimmed to 280 characters.
  - **~16 audience-facing strings shortened** in both languages; EN/ES stayed identical key by key.

## 2. Closing out the four console sections (confirmed in later sessions)

The four console sections — Agents, Gateway, Observability, and Platform — are complete, audited against real Azure, and closed. Each one passed: typecheck, build, live verification against real Azure, and code cleanup. No open bugs remain, with two exceptions deliberately documented as technical debt, not fixed:

- **(a)** An error-handling pattern in `AuditRecordSection.tsx` (Observability section) that silently swallows errors. Documented, deferred to a future task.
- **(b)** The Observability detail dialog closes silently if the broker fails while the dialog is open. Reported, not fixed, pending a decision.

### New feature: deleting agents from the UI

Added the ability to delete agents from the interface — a button next to the create-agent one, in the Agents section — with a confirmation requiring the user to type the exact agent name before proceeding. Implemented both in the broker (`DELETE /api/agents/:name`) and the frontend. Verified live against real Azure: creation, deletion, and a subsequent retry confirming a correct 404.

### Copilot knowledge base: positioning clarification

Added a new entry to `broker/src/demoKnowledge.ts` so the conversational assistant never presents this application as a replacement for Azure AI Foundry. Verified live in both English and Spanish.

### Documentation reorganization

Complete. All project documentation was consolidated into `demo-app/docs/`, with a parallel structure in English (`docs/en/`) and Spanish (`docs/es/`), plus root-level community files (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ACKNOWLEDGEMENTS.md`, `CHANGELOG.md`) and an `assets/` folder for the banner, the lab diagram, and screenshots — leaving the project ready to publish as an open-source repository.

## 3. Outstanding work (per the base document, 2026-08-03)

1. **Visual verification — was still the biggest risk as of that date.** Six UI milestones had been written and type-checked, but never seen in a browser; browser tooling was declined for that session. Every proportion had been reasoned from the token scale and measured arithmetic, not observed. A human review was needed at 1920×1080 and 1366×768 across all five stops, specifically checking: whether ② Hosted Agents and ⑤ Operations scrolled internally (expected to, and the two most at risk of feeling cramped); whether the six-tile KPI strip and the three credential outcomes held up at 1366 without wrapping; whether the 1200px measure inside a 1600px shell read as deliberate at 1920 or as an empty card; and both light **and** dark mode, since only light had been reasoned through up to that point.
2. **Confirm tool-call visibility** — a `get_weather` span had never been observed because no question had triggered one.
3. **Time "Ask both" against the clock** — it was reasoned that two agents in parallel stayed within the ~15 s ceiling, without an actual measurement.
4. **Replay capture** — Simulation was still hand-written mocks, not a recording.
5. **Localize broker responses** — `/api/controls`, governance evidence, and maintenance results were still English-only, not routed through `i18n/translations.ts`.
6. **Make attribution survive restarts** — the asks store was still in-memory.
7. **Live RBAC verification** — requires the `Microsoft.Authorization/roleAssignments/read` permission.
8. **Re-argue the ten-minute budget** — the Presentation Flow still described building six panels and gave its biggest moment to Access Control on the basis of the already-retired thesis. The in-app Presenter Guide was the accurate reference.
9. **Restore the authorized direct call** (Phase 2.6) — the lab teaches the direct path as a troubleshooting baseline that *should* succeed; the application only ever showed it failing.

## 4. Known limitations (per the base document)

- All Azure telemetry has a 1–3 minute delay; panels show "ingestion pending," never a zero.
- Hop 1 and hop 2 carry different correlation IDs and are associated by timestamp proximity — it's an association, not a single measured transaction, and both the UI and the script say so.
- Tokens measure the model call, which is what the gateway bills, not the agent invocation.
- `apim-request-id` cannot be used to join (verified: zero matches in Log Analytics).
- Observability correlation is in-memory — a broker restart resolves past asks to an honest 404.
- `az role assignment list` returns `[]` under the identity used — a permissions gap, not an error.
- ~10–17 s cold start on the first Ask. CORS verified with `curl`, not with a browser.
- Never available, never fabricated: internal cost/billing · throttling in action · semantic caching · load balancing · historical trends · uptime/SLA · private networking · multi-region failover · evaluations / red teaming / security scores.
- Frameworks are never compared on performance. No latency figure, token count, or throughput is rendered per framework anywhere, including "Ask both," which discards the real latency both calls return. Differences between the two agents are variance within a shared model.
- The capability matrix is source code, not telemetry — it's read from `src/frameworks/*/main.py`, a truth about the code, not a measurement of the running containers. The only live differentiator is "Ask both."

## 5. Current architecture

```
Browser (demo-app, :5173) ──REST/JSON──▶ Broker (Express, :4000) ──▶ APIM · Foundry · ARM · LA · ACR
```

The browser never touches Azure — structurally impossible, it has no Azure SDK. The broker holds the APIM subscription key (`broker/.env`, git-ignored) and the `az login` context, and its outbound call to the agent passes *through* APIM exactly as a real client would. The one deliberate bypass is the "direct to Foundry" branch, intended to fail with a 401.

The demo's theme is **custom frameworks running as managed platform assets**: two containers in two SDKs, registered as Foundry Hosted Agents behind a single Responses protocol contract, immutably versioned and pinned by digest. The **dual-gateway pattern** is the enterprise perimeter around them — APIM twice on a single path, injecting managed-identity tokens for `https://ai.azure.com` and `https://cognitiveservices.azure.com`. Both things are true; the ordering is the Phase 1 correction.

The frontend swaps `simulationService` / `azureService` behind a single `DemoDataService` contract; every `azureService` method goes through a single `brokerFetch()`.

## 6. Azure status as of 2026-08-03

Resource group live and healthy. APIM `apim-{suffix}` (Basicv2) · `foundry-agents-…` + `foundry-models-…` with projects · `gpt-5-mini` (GlobalStandard, RAI `Microsoft.DefaultV2`) · `acr{suffix}` · `workspace-{suffix}` + App Insights. ARM reported 8 top-level resources. Role-assignment reads were denied for the identity used in verification.

## 7. Recommended next milestone (per the base document)

**Rehearsal — as of that date, already five milestones overdue.** Run the Presentation Flow's pre-flight through Presenter Tools → Maintenance, walk through all five stops at 1920×1080 and 1366×768, open and close the copilot at each one, run "Ask both" and time it, ask a weather question to determine whether tool-call spans appear, and record the replay capture while doing so. A single session would close the visual, timing, tool-call, and capture gaps all at once.

**Do not treat the 10:00 script as current** — see item 8 of the outstanding-work section.

---

*Note: sections 1, 3, 4, 5, 6, and 7 reflect the documented state as of 2026-08-03. Section 2 incorporates facts confirmed in later sessions. This document should keep being updated at every new milestone.*

## See also

- [`AZURE_INTEGRATION_REPORT.md`](AZURE_INTEGRATION_REPORT.md) — the endpoint-by-endpoint verification detail.
- [`HISTORY.md`](HISTORY.md) — the full chronological development history.
- [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) — the philosophy and decisions behind this status.
