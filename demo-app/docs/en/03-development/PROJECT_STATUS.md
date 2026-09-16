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
- `CORS_ORIGIN` accepts exactly one origin. A comma-separated list is echoed back whole in `Access-Control-Allow-Origin`, which browsers reject, while the preflight still returns 204 — so `curl` passes and only a browser fails. Pointing a deployed broker at a local frontend means replacing the value, not appending to it. See `broker/.env.example`.
- Never available, never fabricated: internal cost/billing · throttling in action · semantic caching · load balancing · historical trends · uptime/SLA · private networking · multi-region failover · evaluations / red teaming / security scores.
- Frameworks are never compared on performance. No latency figure, token count, or throughput is rendered per framework anywhere, including "Ask both," which discards the real latency both calls return. Differences between the two agents are variance within a shared model.
- The capability matrix is source code, not telemetry — it's read from `src/frameworks/*/main.py`, a truth about the code, not a measurement of the running containers. The only live differentiator is "Ask both."

## 4b. APIM reference screen (2026-08-31)

A second screen under the Gateway section, `apimCapabilities`, describing the
Azure API Management product rather than this deployment: eight capabilities,
a tier comparison, and how the model is chosen for an agent.

It is reference material, and the separation from live data is structural
rather than a caption — its own stop behind a Live/Reference tab pair, the
`illustrative` band (§1.6), a permanent banner, and a per-capability pill
saying whether this lab configures it (three of eight do).

The one live value on it is the APIM tier, newly exposed by the broker from
the ARM listing `/api/environment` already fetches. It highlights nothing when
the broker omits it, and is not read at all in Simulation mode.

The tier comparison carries this project's own measurement — Basicv2 against
Consumption, 54 s cold start after 35 minutes idle — rather than datasheet
guidance. See `labs/…-automation/docs/06-apim-consumption.md`.

Presenter script: [`APIM_CAPABILITIES_GUIDE.md`](../02-presentation/APIM_CAPABILITIES_GUIDE.md).

## 4c. Presenter-brand mark in the rail (2026-09-07)

The "Controles Empresariales" mark now appears in the navigation rail's
footer — just the geometric mark, matted against transparency, not the full
wordmark lockup (no contrast against the rail's fixed dark ground in either
theme). All nine stage screens were re-measured at 1366×768 before and after:
no change to the 0px-hidden-content budget. Deployed to production with a
code-only redeploy (infrastructure, agent images, and agent registration all
skipped) and verified live. Full detail in [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) §4.12
and [`HISTORY.md`](HISTORY.md) item 15.

## 4d. Rail palette, and the mark promoted to the brand block (2026-09-10)

The navigation rail took a supplied palette — plum ground `#17132b`, pink
`#e2196f` for the active section, indigo `#4f46e5` for "live" — and the
presenter's mark moved from the rail footer to the brand block at the top,
resized to a compact single-row lockup, with the positioning tagline
relocated to the rail footer. `Sidebar.tsx` and the `--color-rail-*` block are
the whole change; every other colour in the console is untouched.

The active item briefly moved to indigo mid-session, over a hue-collision read
between the pink and the presenter's crimson mark (15.9° apart, ΔE2000 10.3 —
correct as a hue measurement). A screenshot of the deployed app this palette
actually comes from overrode that: it runs the same two colours the same
distance apart and reads fine, because a 34px mark beside two lines of text
doesn't compete with a filled nav pill 30px below it the way a 150px stacked
lockup does. **The active item is pink again** (`#e2196f`, 3.95:1 on the rail
ground, clearing the bar the indigo's 2.87:1 could not); what actually
changed is the brand block's size and layout, not its colour. Full sequence
in [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) §4.13–§4.14.

Green did not come across from the reference mockup: `affirm` is still
**exactly one use** in the codebase (`StatusPill.tsx`, the 401), verified by
census across all three revisions. One palette value was not adopted
verbatim — `#4f46e5` measures 2.87:1 on the rail ground and is used at
`#7b74ec` (4.77:1) for the two marks (the Live dot, the agent glyph) that sit
directly on it. All nine screens re-measured at 1366×768, both rail states and
both modes, three times over (pink → indigo → pink again): 32 measurements
each pass, all identical to the pre-change baseline.

**Not deployed.** Held at the presenter's instruction pending review of the
captures.

## 4e. `.env.local` and this repo's own deploy default pointed at a resource group that no longer exists — the live one is `-v2` (corrected 2026-09-10)

**Correcting the entry this replaces.** It said Live mode had no backend at
all. That was wrong in the consequential half: a live deployment exists, just
not the one this repo's own configuration named.

`az` does report `ResourceGroupNotFound` for `lab-hosted-agents-demo`, and
`hosted-agents-demo-f76df303.azurewebsites.net` — the host in
`demo-app/.env.local`, and `deploy.ps1`'s own default `ResourceGroupName` in
`config/lab.defaults.psd1` — is NXDOMAIN. But a broader `az webapp list`
turned up `hosted-agents-demo-ba8fb6d3` in resource group
`lab-hosted-agents-demo-v2`, `Running`, `/api/health` returning `{"ok":true}`,
`/api/environment` returning real ARM data. The deployment was recreated under
a new suffix at some point and nothing in this repo — `.env.local`,
`lab.defaults.psd1`'s `ResourceGroupName`, this document's own §6 — was
updated to say so.

**What is actually true:** Live mode has a real backend, at
`https://hosted-agents-demo-ba8fb6d3.azurewebsites.net`, in
`lab-hosted-agents-demo-v2`.

**Resolved, one field each way.** `demo-app/.env.local` (git-ignored, used
only for standalone frontend dev against a remote broker) is corrected to
the `-v2` host and resource group. `lab.defaults.psd1`'s `ResourceGroupName`
default is **deliberately left pointing at the dead group** — not an
oversight, decided and confirmed with the presenter. That field is also
`teardown.ps1`'s default when `-ResourceGroupName` is omitted: stale, it
fails harmlessly; corrected to `-v2`, a bare `teardown.ps1` would target the
live deployment instead. The full reasoning lives as a comment on the field
itself in `config/lab.defaults.psd1`, specifically so a future pass does not
"fix" it back to something that resolves. Every `deploy.ps1` / `teardown.ps1`
invocation against `-v2` in this project, from here on, passes
`-ResourceGroupName lab-hosted-agents-demo-v2` explicitly — as this session's
own redeploy did. §6 and
[`AZURE_INTEGRATION_REPORT.md`](AZURE_INTEGRATION_REPORT.md) still record
figures verified against the *previous* deployment; nothing in this entry
re-verifies them against `-v2`.

## 4f. `-v2`'s identity was missing Reader on the shared APIM — fixed and verified live (2026-09-11)

Two Settings → Maintenance actions ("Recargar políticas", "Actualizar
información del despliegue") 403'd. Root cause was exactly §4e's shape one
level down: the App Service identity is new whenever the App Service itself
is recreated, and `Grant-DemoAppServiceRoles` in `deploy.ps1` has never
granted anything on the shared gateway — the Reader grant this document's
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) already records (2026-09-07) was
applied by hand, once, against the old identity, and was never encoded into
the automation. Confirmed directly: 0 assignments for the current principal
(`a29165e4-…`) on the shared APIM before this fix; the old identity's grant
(`c15d914a-…`) is still there, orphaned.

**Fixed**: the same Reader grant, same narrow scope (the APIM resource, not
the resource group), reapplied to the current identity via `az rest` (the
`az role assignment` subcommands returned `MissingSubscription` against this
exact scope, reproducibly — a CLI quirk, worked around with the raw REST
call). **Verified live**, not just granted: both actions clicked for real
against the deployed console immediately after, both `200` with real APIM
data. Full detail, including the exact commands and the additive-count
verification, in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md#the-reader-grant-above-was-never-encoded-into-deployps1-and-recreating-the-app-service-silently-lost-it-2026-09-11).

**Update, same day: the "left open" part is now closed too.** `Grant-
DemoAppServiceRoles` in `AppService.ps1` grants this Reader itself now, as a
fifth grant alongside the four it already made — no more manual step after
the next App Service recreation. Built on a new `Grant-RoleIfMissingRest`
(same idempotent/retry contract as the existing `Grant-RoleIfMissing`, but
over `az rest` rather than `az role assignment`, because the shared-APIM
scope is exactly where that subcommand's `MissingSubscription` quirk lives)
— `Grant-RoleIfMissing` itself is untouched, since its other three callers
have never shown the problem. Verified three ways against the live `-v2`
deployment: `-ValidateOnly` still passes (the weak check — it never reaches
this code); a direct call to `Grant-DemoAppServiceRoles` against real `-v2`
values reported all five grants `(already granted)`, correctly recognizing
the Reader applied by hand hours earlier; and the create branch itself was
exercised against a real, harmless principal (the shared gateway's own
identity, temporarily granted AcrPull, confirmed present, then deleted and
reconfirmed gone). Full detail in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md#the-gap-closed-grant-demoappserviceroles-now-grants-the-shared-apim-reader-itself-2026-09-11).

## 4g. Cold start decomposed with real telemetry — diagnosis only, nothing changed (2026-09-11)

"8–17 s measured" (§6, the risk register's #1 item) is now a real breakdown,
not a range. Three real invocations against `pydantic-agent` — a warm-up
(one-word reply), and two open questions (short and long answers) — cross-
validated against two independent telemetry sources
(`ApiManagementGatewayLogs` and `union AppRequests, AppDependencies`, the same
tables `journey.ts`/`observability.ts` already query):

| | fixed gap before `invoke_agent` starts | `invoke_agent` itself | — of which, the model call |
|---|---|---|---|
| warm-up (one word) | 7.30 s | 4.98 s | 1.98 s |
| short answer | 6.67 s | 5.45 s | 2.85 s |
| long answer | 6.40 s | 10.28 s | 8.34 s |

**The dominant cost is a 6.4–7.3 s gap *before* the agent's own instrumented
code (`invoke_agent`, the first span either framework's telemetry emits) even
starts** — it does not scale with response length, which is the signature of
a fixed cost rather than agent work. Nothing this repository's code touches
is positioned to see inside that gap, let alone shorten it: it is upstream of
the broker, the console, and the agent containers alike, on the Foundry
hosted-agent platform itself. Gateway overhead is confirmed negligible again
(2–14 ms). What scales correctly is the model call itself (1.98 s → 8.34 s
with response length). Full breakdown, methodology, and the smaller
framework-side cost worth distinguishing from the fixed gap, in
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md#latency-has-a-real-breakdown-now-not-just-a-measured-range-2026-09-11).

**Nothing was changed** — no agent code, no container sizing, no warm-up
cadence. This was scoped as diagnosis only.

## 4h. The Figma reference adopted; one screen broke and was bought back (2026-09-11)

Adopted across all four sections: 56px topbar, breadcrumb, one-line context
band, a subtitle on the active rail item, the reference's card cosmetics on
Agents, `#D4003B` as the canonical brand red, the rail unified to `#1C1C1C`,
and the landing page removed. Six commits, priced in `FIGMA_ADOPTION.md`
before any of it was written.

**Not deployed.** Awaiting approval of the complete set with captures.

**Layout budget, 1366×768, measured against the live backend after the
change:**

| screen | content | budget | margin |
|---|---|---|---|
| Agents / Overview | 415 | 550 | +135 |
| Agents / Versions | 403 | 550 | +147 |
| Agents / Run | 329 | 550 | +221 |
| Gateway / Live | 328 | 510 | +182 |
| Gateway / Credentials | 122 | 510 | +388 |
| Observability / Record | 421 | 550 | +129 |
| Observability / Measurements | 132 | 510 | +378 |
| Platform | 491 | 510 | **+19** |

Eight of nine at 0px hidden. The ninth is Gateway/Reference, which scrolls by
design (§4.9). Platform/Live had gone to −15px and was recovered from the
shared frame's padding and gaps; the band cost 48px where the plan predicted
~30px. Three screens now have *more* room than before the topbar existed.

**The landing page's removal was verified by clicking, not by compiling:** ten
checks against the live backend — boots into a section, Home raises the
confirm dialog with a live conversation, confirming clears the copilot without
reloading, a second full demonstration runs on the same page load, Escape
resets in place.

**Honesty system after the adoption:** `<ProvenanceBadge>` 13, `<StatusPill>`
1, `text-affirm` 1, `bg-affirm` 0, `border-affirm` 0, `border-dashed` 6,
`tone="reference"` 1, no green anywhere. The Live/Simulation dot was
deduplicated from three copies to one and both branches confirmed at runtime.

**Corrected here:** §4.11's 457px content figure for Platform/Live is stale —
it is 491px today, on the pre-change baseline as well, so the screen drifted
with the deployment rather than with any UI change.

**Still open, unchanged:** Platform/Simulation, now −26px against §4.11's
−51px. Still the untranslated control names on the live path, not a layout
defect, and deliberately not fixed here.

**Also open, new:** on Platform the context band and the screen's own
introductory paragraph now sit adjacent — two sentences of preamble before
content. Composition work across five screens, not a layout defect.

**Resumed and re-verified, 2026-09-16.** The session that wrote the above
closed while taking the approval screenshots (four light-theme shots, no
dark). Everything was re-run against HEAD and the live backend rather than
trusted:

- Nine-screen budget: identical to the pixel to the table above.
- Reset: the ten checks pass again. Their step 5 only proved one navigation
  after a reset, so a stricter run was added — a complete second
  demonstration (every section, every sub-tab, a fresh copilot question) in
  the same page load, the first conversation absent from it, zero reloads,
  zero page errors. 35/35. Escape *never* discards a live conversation (it
  closes the copilot, then does nothing); only Home, which confirms, does.
  That guard predates this work and is intended.
- Honesty census: unchanged from the figures above; no green, no version badge.
- Two commits added. `0945395` removes what the landing page left behind (an
  unused `View` type, an unused fade-out animation, and a `resetDemoState`
  docstring still describing the unmount mechanism it replaced). `b513ed2`
  fixes the presenter attribution: `opacity-70` over `rail-ink-muted`
  composited to 4.07:1 before the adoption and 3.94:1 after it — under AA both
  times, and §4.12/`ecd1059` had never measured it. Now 6.65:1.
- AA audited on *rendered* contrast (every visible text node composited over
  its real background, nine screens, both themes) and A/B'd against the
  pre-adoption commit `7d93794`. After `b513ed2` the only failure is
  `pydantic-agent` on Gateway/Live (4.12 light / 4.23 dark), identical on the
  baseline.
- Eighteen screenshots taken, theme, section and mode asserted before each.

**Found, pre-existing, not fixed here:** (1) the topbar's resource count falls
back to a hardcoded `21`; if `getEnvironmentContext()` fails in Live, the bar
reads "Azure live · … · 21" — an invented number under the live label, a §1.6
breach that moved from the rail footer to the topbar with this work.
**Fixed in `b9c4c9a`:** it also showed 21 while loading and throughout
Simulation, and the broker answered `0` for a refused ARM listing; failures
now read "count unavailable", loading and Simulation show no count. (2)
`ProvenanceBadge` labels ("Live", "Illustrative") are hardcoded English. (3)
The request-flow diagram clips its last node ("gpt-5-mir…"), less than on the
baseline. (4) Sub-16px text in Fluent badges (10px) and small buttons
(12–14px), identical on the baseline.

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
