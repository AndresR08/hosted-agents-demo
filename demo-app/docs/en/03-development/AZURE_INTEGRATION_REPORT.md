# Azure integration report

Consolidated evidence of what was integrated with and verified against real Azure during the demo's development, plus the documentation consistency status that resulted from that verification.

---

## How this evidence was collected

The broker (`broker/`) was started clean (`npm run dev`, a running process, not a file change) against the real deployed resource group `{resource-group}` (`swedencentral`), and each endpoint was then exercised with `curl`, capturing the raw HTTP response. Source files were re-read from disk, not from memory, for every cited line number. The one secret involved (the APIM subscription key) is referenced only by its length, never printed, either in this document or in the commands that used it.

**Environment at the time of verification:**

```
$ az account show --query "{user:user.name, subscription:name, tenant:tenantDisplayName}"
{
  "subscription": "<subscription-name>",
  "tenant": "<organization-name>",
  "user": "<user>@<domain>"
}
```

*(Subscription, tenant, and user values anonymized for this publication — the original verification was run against a real subscription, not a simulated one.)*

---

## 1. AI Assistant — real conversation

| | |
|---|---|
| **File** | `broker/src/routes/ask.ts` |
| **Endpoint called** | `POST {APIM_GATEWAY_URL}/hosted-agent-responses/agents/{agentName}/endpoint/protocols/openai/responses?api-version=v1` (line 23, 26–33) |
| **Azure resource** | `apim-{suffix}` → routes to `foundry-agents-{suffix}` / `default-foundry-agents` |
| **Authentication** | `api-key` header taken from `config.apimSubscriptionKey` (line 29), read from `broker/.env` (git-ignored, never logged) |
| **What's still simulated** | Nothing for this call itself. The *predefined scenario responses* (`assistant.suggestion.*.response` in `demo-app/src/i18n/translations.ts`) exist only for Simulation mode — Live mode always shows the real response, per `demo-app/src/features/assistant/AIAssistantPanel.tsx` lines ~130–140 ("real call — the predefined response for the suggested prompt is deliberately ignored here"). |

**Command:**
```
curl -s -i -X POST http://localhost:4000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Verification test: name the Azure service that sits between the client and the Foundry agent, in five words or fewer.","agentName":"pydantic-agent"}'
```

**Result: `HTTP/1.1 200 OK`**

```json
{
  "askId": "caresp_18ca6fe4530eea16002iUak3kbEG2Num4F3Ic0hjNNWK6ZpCNz",
  "answerText": "Azure Application Gateway",
  "agentName": "pydantic-agent",
  "agentVersion": ":3",
  "latencyMs": 16809,
  "httpStatus": 200,
  "provenance": { "band": "live", "asOf": "2026-08-01T04:22:29.991Z" }
}
```

**Why this is solid evidence and not a canned fixture:** the model's response is factually wrong — it should have said API Management, not Application Gateway. No hand-written mock in this codebase would produce a wrong answer; that only happens when a real model generates a genuine response. `latencyMs: 16809` is also genuine request time (the agent was cold — see §8), not a rounded filler value. It was neither corrected nor hidden; it's included as-is because a wrong answer is more convincing proof of "live" than a correct one.

**Note on server-side logging:** the broker doesn't do per-request access logging (only errors are logged — `broker/src/index.ts` line 33). The evidence that this actually reached Azure is the response content itself: an `askId` in Foundry's own ID format (`caresp_…`), an `agentVersion` matching the actually registered version (`:3`, independently confirmed in §3), and a multi-second latency consistent with a real model call, not a simulated one (which is instantaneous).

---

## 2. Request Journey — real structure, per-hop timing NOT implemented

| | |
|---|---|
| **File** | `broker/src/routes/journey.ts` |
| **Endpoint called** | None directly — reads from the in-memory map in `broker/src/askStore.ts`, populated by `recordAsk()` in `ask.ts` line 57 |
| **Azure resource** | None (by design — see below) |
| **Authentication** | N/A |
| **What's still simulated** | Individual per-hop timing (hop 1 of APIM vs. hop 2 separately). The file's own comment (lines 17–24) explains why: it would require correlating Application Insights `requests`/`dependencies` by operation ID, and that data has a documented ingestion delay of 1–3 minutes — for a request that just completed, it isn't queryable yet. |

**Command:**
```
curl -s -i http://localhost:4000/api/journey/caresp_18ca6fe4530eea16002iUak3kbEG2Num4F3Ic0hjNNWK6ZpCNz
```

**Result: `HTTP/1.1 200 OK`**

```json
{
  "askId": "caresp_18ca6fe4530eea16002iUak3kbEG2Num4F3Ic0hjNNWK6ZpCNz",
  "totalLatencyMs": 16809,
  "provenance": { "band": "live", "asOf": "2026-08-01T04:22:41.450Z" },
  "hops": [ /* 5 nodes, each with a static credentialFact string, no per-hop durationMs field */ ]
}
```

`totalLatencyMs: 16809` matches the `/api/ask` response exactly — proof this is real correlation, not two independent mocks that happen to agree. No hop in the array carries a `durationMs` value, which is consistent with the "not implemented" claim rather than contradicting it — the field is simply absent, not present-and-false.

**Classification: partially live.** Total latency and flow structure are real; per-hop timing is honestly absent.

---

## 3. Active agents — real, and deliberately incomplete

| | |
|---|---|
| **File** | `broker/src/routes/agents.ts` |
| **Endpoint called** | `GET {FOUNDRY_AGENTS_PROJECT_ENDPOINT}/agents?api-version=v1` (line 36); ACR via `az acr manifest list-metadata` (lines 83–90, invoked as a subprocess) |
| **Azure resource** | `foundry-agents-{suffix}` / `default-foundry-agents`; `acr{suffix}` |
| **Authentication** | Bearer token, scope `https://ai.azure.com/.default` (`azureAuth.ts` `SCOPES.foundry`); ACR calls use the same `az login` session the broker was started with |
| **What's still simulated** | Nothing for `pydantic-agent`. `strands-agent` isn't returned — because it isn't registered, not because it's filtered out. |

**Command 1:**
```
curl -s -i http://localhost:4000/api/agents
```
**Result: `HTTP/1.1 200 OK`**
```json
[{"name":"pydantic-agent","version":":3","framework":"Pydantic AI","status":"Running"}]
```

**Command 2:**
```
curl -s -i http://localhost:4000/api/agents/pydantic-agent/provenance
```
**Result: `HTTP/1.1 200 OK`**
```json
{
  "agentName": "pydantic-agent",
  "imageUri": "acr{suffix}.azurecr.io/pydantic-agent:3",
  "imageDigest": "sha256:b4d03d1a20ebc09b22a69adb537882e6877325733b646cc6f0a12c1569c3cfca",
  "pushedAt": "2026-07-30T18:35:54.6128372Z",
  "versionCreatedAt": "2026-07-30T18:37:54.000Z",
  "environmentVariableKeys": ["AZURE_OPENAI_ENDPOINT","AZURE_OPENAI_API_VERSION","AZURE_OPENAI_DEPLOYMENT","APIM_SUBSCRIPTION_KEY","LOG_LEVEL"],
  "provenance": { "band": "live", "asOf": "2026-08-01T04:23:20.740Z" }
}
```

**Command 3 (negative-case evidence — proves this reads a live registry, not a fixed list):**
```
curl -s -i http://localhost:4000/api/agents/strands-agent/provenance
```
**Result: `HTTP/1.1 404 Not Found`**
```json
{"error":"Agent strands-agent is not registered"}
```

**Independent confirmation that `strands-agent` genuinely doesn't exist in this deployment:**
```
$ az acr repository list --name acr{suffix} -o table
Result
--------------
pydantic-agent
```

**Classification: verified live** (for what it returns), with the gap honestly reflected — one real agent, not two.

---

## 4. Access control — real three-way test + real live policy

| | |
|---|---|
| **File** | `broker/src/routes/accessControl.ts` (test), `broker/src/routes/policy.ts` (policy) |
| **Endpoints called** | The same hosted-agent-responses URL from §1, invoked 3 ways: with the subscription key, without it, and directly against `{FOUNDRY_AGENTS_PROJECT_ENDPOINT}/agents/pydantic-agent/...` with no authorization header (`accessControl.ts` lines 21–39). Policy: `GET https://management.azure.com/.../apis/hosted-agent-responses-api/policies/policy?api-version=2022-08-01&format=xml` (`policy.ts` lines 27–30) |
| **Azure resource** | `apim-{suffix}`; `foundry-agents-{suffix}` (direct-bypass branch); ARM |
| **Authentication** | Branch 1: `api-key`. Branch 2: none (deliberately). Branch 3: none (deliberately — that's the point of the test). Policy fetch: Bearer token, scope `https://management.azure.com/.default` |
| **What's still simulated** | Nothing. All three branches and the policy fetch are live. |

**Command 1:**
```
curl -s -i -X POST http://localhost:4000/api/access-control-test
```
**Result: `HTTP/1.1 200 OK`**
```json
{
  "attempts": [
    {"id":"with-subscription-key","credentialPresented":"Subscription key","httpStatus":200,"outcome":"success"},
    {"id":"without-subscription-key","credentialPresented":"(none)","httpStatus":401,"outcome":"rejected"},
    {"id":"direct-to-foundry","credentialPresented":"Direct to Foundry, no Entra token","httpStatus":401,"outcome":"rejected"}
  ],
  "provenance": {"band":"live","asOf":"2026-08-01T04:23:43.523Z"}
}
```

**Command 2:**
```
curl -s -i "http://localhost:4000/api/policy/hosted-agent-responses-api"
```
**Result: `HTTP/1.1 200 OK`** — real XML straight from ARM, with tab indentation (ARM's own formatting, distinct from the space-indented copy in the repository's `.xml` file — proof this came from the live API, not from reading a local file):

```xml
<policies>
	<inbound>
		<base />
		<!-- Get managed identity token for Foundry Responses API -->
		<authentication-managed-identity resource="https://ai.azure.com" output-token-variable-name="managed-id-access-token" ignore-error="false" />
		<!-- Set bearer token in Authorization header -->
		<set-header name="Authorization" exists-action="override">
			<value>@("Bearer " + (string)context.Variables["managed-id-access-token"])</value>
		</set-header>
		...
```

**Classification: verified live.**

---

## 5. Audit record — real Log Analytics query

| | |
|---|---|
| **File** | `broker/src/routes/auditRecord.ts` |
| **Endpoint called** | `POST https://api.loganalytics.io/v1/workspaces/{workspaceId}/query` (lines 34–41), query text on lines 30–32 |
| **Azure resource** | `workspace-{suffix}`, table `ApiManagementGatewayLlmLog` |
| **Authentication** | Bearer token, scope `https://api.loganalytics.io/.default` |
| **What's still simulated** | Nothing structurally — but `ResponseMessages` came back empty for the row captured below, and the code (lines 87–96) returns `"(not captured at the gateway for this request)"` instead of inventing a response. That fallback text is itself evidence that the honesty constraint is being followed, not evidence of an integration gap. |

**Command:**
```
curl -s -i http://localhost:4000/api/audit-record
```
**Result: `HTTP/1.1 200 OK`**
```json
{
  "timestamp": "2026-08-01T04:22:24.6244752Z",
  "subscriptionName": "subscription1",
  "modelName": "gpt-5-mini",
  "prompt": "user: Verification test: name the Azure service that sits between the client and the Foundry agent, in five words or fewer.",
  "completion": "(not captured at the gateway for this request)",
  "provenance": {"band":"live-delayed","ageSeconds":102.271}
}
```

**Why this is decisive evidence:** the `prompt` field is word-for-word the question asked in §1's call to `/api/ask`, two minutes earlier (`ageSeconds: 102.271` — consistent with the real elapsed time between the two curl calls in this session). This isn't a fixture; it's Log Analytics returning the actual row the test request wrote.

**Classification: verified live.**

---

## 6. Controls — mixed: live wherever the credential's permissions allow

| | |
|---|---|
| **File** | `broker/src/routes/controls.ts` |
| **Endpoints called** | `GET .../Microsoft.ApiManagement/service/{apim}/providers/Microsoft.Insights/diagnosticSettings` (line ~41); `GET .../Microsoft.CognitiveServices/accounts/{foundryModels}/deployments` (line ~50) |
| **Azure resource** | `apim-{suffix}`; `foundry-models-{suffix}` |
| **Authentication** | Bearer token, scope `https://management.azure.com/.default` |
| **What's still simulated** | Full enumeration of RBAC role assignments — see below, re-verified in this session. |

**Command:**
```
curl -s -i http://localhost:4000/api/controls
```
**Result: `HTTP/1.1 200 OK`** — note `"RAI Microsoft.DefaultV2"` embedded live in the response, and `"diagnostic settings confirmed live"` in the audit-logging item's text:
```json
{
  "active": [
    {"id":"subscriptionKey","name":"Subscription-key authentication, per-consumer revocation"},
    {"id":"managedIdentity","name":"Managed-identity brokering, both hops"},
    {"id":"headerEnforcement","name":"Header enforcement and preview feature gating"},
    {"id":"auditLogging","name":"Full prompt / completion audit logging (diagnostic settings confirmed live)"},
    {"id":"diagnostics","name":"Diagnostics to Log Analytics and App Insights"},
    {"id":"contentFiltering","name":"Content filtering at the model (RAI Microsoft.DefaultV2)"},
    {"id":"registryRbac","name":"Least-privilege, repository-scoped registry RBAC"}
  ],
  "available": [ /* 6 items, static unchanged list */ ],
  "provenance": {"band":"live","asOf":"2026-08-01T04:24:09.376Z"}
}
```

**The gap, re-verified this session:**
```
$ az role assignment list --resource-group "{resource-group}" -o json
[]
```
Empty — not an error, an empty authorization result. The identity signed in can read policies, diagnostic settings, and deployments in this resource group, but not role assignments. `registryRbac` in the active list above is therefore the one line in this entire integration that is *documented*, not *verified live*.

**Classification: partially live** — 6 of 7 active items are verified live; the RBAC line is a static, accurate, but unverified fact.

---

## 7. Header / environment

| | |
|---|---|
| **File** | `broker/src/routes/environment.ts` |
| **Endpoint called** | `GET https://management.azure.com/subscriptions/{sub}/resourceGroups/{rg}/resources?api-version=2021-04-01` |
| **Azure resource** | The resource group itself (ARM) |
| **Authentication** | Bearer token, scope `https://management.azure.com/.default` |

**Command:**
```
curl -s -i http://localhost:4000/api/environment
```
**Result: `HTTP/1.1 200 OK`**
```json
{"region":"swedencentral","resourceGroupName":"{resource-group}","resourceCount":8,"provenance":{"band":"live","asOf":"2026-08-01T04:24:09.759Z"}}
```

`resourceCount: 8` is deliberately *not* 21 (the number the lab's architecture document recorded) — this is a live, top-level ARM resource count, which doesn't enumerate sub-resources (role assignments, API operations, diagnostic settings) the way a manual inventory does. The discrepancy is expected and is itself evidence that it isn't a fixed 21.

**Classification: verified live.**

---

## 8. Broker architecture

### Request flow

```
Browser (fetch) → Express app (index.ts) → cors middleware → express.json() → route handler
                                                                                       │
                                                                      fetch() to Azure REST / APIM
                                                                                       │
Browser ← JSON response ← route handler ← Azure response, adapted to the DemoDataService contract
```

Concretely, `demo-app/src/services/azure/azureService.ts` line 26 — every method goes through a single `brokerFetch()` helper that calls `${env.brokerBaseUrl}${path}`. `env.brokerBaseUrl` defaults to `http://localhost:4000` (`demo-app/src/config/env.ts`). There is no other network call anywhere in the frontend code.

### Middleware (`broker/src/index.ts`)

| Order | Middleware | Purpose |
|---|---|---|
| 1 | `cors({ origin: config.corsOrigin })` (line 14) | Restricts which browser origins can read the response — see Security model below |
| 2 | `express.json()` (line 15) | Parses request bodies for `POST /api/ask` and similar routes |
| 3 | 8 route routers, each mounted under `/api` (lines 17–24) | One file per data need — see §1–§7 |
| 4 | Error-handling middleware (lines 31–35) | Catches any exception forwarded by `asyncHandler` and returns a clean `502` instead of hanging the process or the request |

### Routing

One `express.Router()` per area of responsibility (`routes/ask.ts`, `routes/journey.ts`, `routes/agents.ts`, `routes/accessControl.ts`, `routes/policy.ts`, `routes/auditRecord.ts`, `routes/controls.ts`, `routes/environment.ts`), each exporting a router mounted under the shared `/api` prefix. No route touches another route's Azure call directly — the only shared state is the in-memory map in `askStore.ts`, read by `journey.ts` and written by `ask.ts`, which is how `totalLatencyMs` travels from one endpoint to the other (verified as real in §2).

### Security model

1. **The subscription key never leaves the broker process.** It's read once from `broker/.env` (`config.ts` line 19), attached as an outbound header in exactly two places (`ask.ts` line 29, the "with key" branch of `accessControl.ts`), and never included in any JSON the broker returns. Verified in this session:
   ```
   $ curl -s http://localhost:4000/api/agents/pydantic-agent/provenance | grep -c "$KEY"
   0
   ```
   (`$KEY` was the real 32-character value read directly from `.env`; zero occurrences in a response that legitimately includes the *names* of that agent's other environment variables — `APIM_SUBSCRIPTION_KEY` appears as a key name in `environmentVariableKeys`, never as a value).

2. **The frontend has no way to call Azure even if it wanted to.** `demo-app/package.json` contains no Azure packages (only `@fluentui/*`, `react`, `zustand`). `broker/package.json` does contain `@azure/identity`. This is a structural fact, not a runtime behavior that could silently regress — the browser bundle cannot construct a credential or call an Azure SDK method that doesn't exist in it.

3. **CORS restricts which origins can read the broker's responses.** `cors({ origin: config.corsOrigin })` always responds with the single configured origin (`http://localhost:5173`) in `Access-Control-Allow-Origin`, regardless of what `Origin` header the caller sent:
   ```
   $ curl -s -i http://localhost:4000/api/environment -H "Origin: http://evil-site.example"
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: http://localhost:5173
   ```
   **Caveat, stated precisely:** `curl` doesn't enforce CORS — only browsers do, by reading this response header client-side and discarding the response if it doesn't match their own origin. This test proves the *header content* is correct (it never reflects an arbitrary request origin); it doesn't by itself prove a browser was blocked, because no browser was used to test it.

4. **No credential is configurable from the browser.** Every `AZURE_*` and `APIM_*` value lives in `broker/.env`, confirmed git-ignored:
   ```
   $ git check-ignore -v broker/.env
   broker/.gitignore:3:.env	labs/.../broker/.env
   ```
   The only frontend setting related to the broker is `VITE_BROKER_BASE_URL`, a URL, not a credential.

### Why the browser never receives secrets — summary

It isn't a policy the code chooses to follow — it's a structural property of where the credential lives (§8.1) combined with the frontend having no code path capable of calling Azure directly (§8.2, verified by absence of dependencies, not by inspecting intent).

---

## 9. Consolidated verdict

### Verified live
- **① AI Assistant** — real round trip APIM → Foundry → APIM → `gpt-5-mini` (§1)
- **③ Access control** — all three credential tests, real policy XML from ARM (§4)
- **④ Active agents** — real registry read for `pydantic-agent`; correctly absent for `strands-agent` (§3)
- **⑥ Audit record** — real Log Analytics query, verified by prompt-text correlation (§5)
- **Header / environment** — real resource count and region from ARM (§7)

### Partially live
- **② Request Journey** — real total latency and flow structure; per-hop timing not attempted, honestly absent rather than estimated (§2)
- **⑤ Controls** — 6 of 7 active items are live ARM checks; registry RBAC is a documented, unverified fact, due to a real permissions gap in the current identity (§6)

### Still simulated (Simulation mode only, or not implemented at all)
- Predefined suggested-scenario response text (`assistant.suggestion.*.response`) — only used in Simulation mode; Live mode always shows the model's real response (§1)
- `strands-agent` — not simulated as a second row; it's simply absent, because it was never registered in this deployment (§3)
- APIM per-hop timing breakdown — not implemented in either mode; no code path exists yet that produces this value
- Full enumeration of RBAC role assignments for Controls — not queryable with the current credential; the active-list line is accurate but static
- Localization of broker responses — the text of `/api/controls` is English-only regardless of the presenter's configured language

---

## Documentation consistency audit

Following the UI and Azure-integration milestones, a consistency audit of six project documents was run against what was actually implemented in `demo-app/` and `broker/`, under these rules: update only what had become factually incorrect, don't rewrite design decisions, don't change the architecture, don't modify application code.

**Method.** All six documents were read in full, and then a source of truth was established from the implementation itself — `AppShell.tsx`, `AIAssistantPanel.tsx`, `useKeyboardShortcuts.ts`, `state/types.ts`, `config/env.ts`, `i18n/translations.ts`, `PresenterMenu.tsx`, `main.bicep`, `broker/.env`, and both `.env.example` files — not from the summaries of the previous milestone. Where a document and the code disagreed, the code was treated as authoritative.

**Editing principle.** The original design text and its reasoning were preserved everywhere. Divergences were logged as marked inline notes ("Overridden in implementation," "As built," "⚠️"), never by deleting the reasoning. This keeps every document usable as the record of *why* a decision was made, while making it accurate about *what exists*.

### Documents updated

| Document | Verdict |
|---|---|
| Project context | **Updated** — heavily. Its status, component table, and build order were all wrong |
| Demo design | **Updated** — band reclassification in §3, agent versions, mode naming |
| UI blueprint | **Updated** — the most divergent document; the layout and panel ① were replaced during the build |
| Presentation flow | **Updated** — three script beats assumed data that doesn't exist |
| Architecture document | **Updated** — two minor factual corrections, both pre-existing, not caused by the integration |
| Session state | **Unchanged** — written on 2026-08-01 from the verification evidence; it was still accurate |

### Why each one was out of date, and what changed

**Project context.** It had been written before the implementation and never revised. It claimed "implementation not started — awaiting approval to build" and "no code written, no repository file modified," which would lead a fresh session to believe `demo-app/` and `broker/` don't exist. Changed: the status line (now built, Live mode connected to real Azure, pointing to the session state); the full RBAC table was removed from the "genuinely live" list and the reclassification reason logged (the presenter's identity can't read role assignments); the mode is now labeled Azure Live / Simulation, where Simulation renders simulated content instead of a capture of the real deployment; the 12-column component table was replaced with the two-column layout as built; the keyboard-shortcut count was corrected (seven bindings, not six); the document table was expanded; it was rewritten to describe the actual state and log the two overrides that happened during implementation; the locally hosted presenter application was described as built, and it was noted that pre-registering both agents (a stated prerequisite) has **not** been done; the build order became a status table, and the footer no longer says "awaiting approval."

**Demo design.** The section governing what the application is allowed to claim had three items that live verification moved between bands, and the document still said "not implemented." Changed: the status header (approved and implemented, pointing out that the five-screen structure was replaced by the UI Blueprint *before* implementation, not by this audit); the full RBAC role-assignment table was struck from the 🟢 LIVE band; `ApiManagementGatewayLlmLog` was updated from "confirm during rehearsal" to verified for **prompts**, with the empty-completions caveat stated; per-hop APIM durations were marked as **not implemented** in either mode; two rows were added (RBAC reclassified 🔴 with the reason, and a **NOT DONE** marker on the recommendation to pre-register both agents); it was logged that the toggle was implemented as Azure Live / Simulation in Settings rather than a header Live / Replay switch, and that Simulation is simulated content, not a rehearsal capture; agent versions were updated from `:2` to `:3`, with a warning that the second agent row doesn't exist.

**UI Blueprint.** The most divergent document. Two of its decisions were deliberately overridden during implementation on explicit instruction — the layout and the single-turn Ask — and the document described neither. Several concrete values were stale. Changed: a status header with a table declaring both input changes, plus the landing page and settings panel as unspecified additions; the single-turn-assistant decision was marked overridden, describing the actual multi-turn assistant, while keeping the original argument because the risk it names (the room debating response quality) still has to be managed verbally; the real two-column composition was added as an ASCII diagram; the Answer panel was marked as no longer existing as a separate region; override notes were added for the merged panel; agent versions were updated to `:3` and the measured cold-start range (10–17 s) was added against the aspirational "1.8 s"; per-hop durations and the derived internal agent time were struck through as **not implemented**; a warning was added that only one agent row renders; it was documented that the Controls active list has seven items, that the registry RBAC line is documented but not verified live, and that that panel's text is English-only; it was logged that "Warm agent" and "Refresh telemetry" are disabled in the presenter menu; the shortcuts table was expanded to the seven real bindings with their guard conditions.

**Presentation flow.** The highest operational risk of the four. The script instructed the presenter to point at per-hop timings, a second agent, and a completion field — none of which is currently on screen. A presenter following it literally would describe things the audience can't see. Changed: a status header with a table naming the three beats whose assumptions no longer hold; cold start was quantified at 10–17 s and the "warm agent" item's **disabled** warning was flagged; one item was marked pending; another was reworded (version history is satisfied at `:3`); another was split between confirmed prompt and unconfirmed completion; another was marked not yet done; one beat was updated to `:3`, with the assistant in the left column and the instruction to read whatever version is on screen rather than memorize a number; another beat was rewritten because the honest answer changed: there are no per-hop figures to defend; another beat received a stop marker with three explicit options (register Strands / run in Simulation / cut the point) and the instruction not to describe an agent that isn't on screen, removing RBAC from the live-resources list; another beat received guidance to check completion capture beforehand and adjust the wording instead of pointing at a "(not captured…)" field mid-sentence; the recovery section was renamed from Replay to Simulation, with the wording corrected to "a local capture" since no recording of this deployment exists; the full RBAC table was struck from the 20-minute expansion; `P` and `Esc` were documented as off-script shortcuts, and it was logged that the beats have not been timed against a clock.

**Architecture document.** Documents the lab (Bicep, notebook, agent containers), which the demo work didn't touch — so almost all of it was still correct. Two factual errors surfaced during verification. Both are pre-existing and weren't caused by the integration; they were fixed here because the audit checked them directly against `main.bicep`. Changed: "the 13 outputs" was corrected to **12** (`main.bicep` contains exactly twelve `output` declarations and the table already listed twelve rows); it was noted that the deployed resource group is `{resource-group}` with `{suffix}`, and that the manual 21-row inventory and the top-level ARM count (8) measure different things. No architectural content was altered.

### Remaining inconsistencies (deliberately not fixed)

Each of these is either out of the stated scope or needs a decision.

**Application code — out of scope by instruction.** Three stale comments/values remain in the code: a frontend config comment stating that nothing in the Azure services is connected yet (no longer true), and the default resource group name not matching the deployed one; a deployment-outputs loader that still returns filler values for all thirteen fields and whose comment cites "the 13 outputs" (there are 12) — the header now gets real values from `/api/environment`, so this loader appears unused, though this wasn't exhaustively verified; a keyboard-shortcuts hook comment saying it doesn't call Azure, "that belongs to the broker milestone," which has since happened; and the frontend's example environment file, which describes the broker as "not yet implemented" and "not part of this scaffold."

**`demo-app/README.md`** (not the official lab README) — as of this verification it still said "architecture scaffolding only. No business logic, no Azure connectivity." Flatly wrong by that point. It wasn't part of the set audited by this report, so it was left untouched at the time — **it has since been rewritten in full** as part of the documentation reorganization this very file is part of; see [`../../../../README.md`](../../../../README.md) for the current version.

**Unresolved factual questions**, which the documentation cannot settle on its own: whether `ApiManagementGatewayLlmLog` captures completions on this surface at all, or whether the empty `ResponseMessages` was specific to that row; whether the 1366×768 degradation rules still hold in the new two-column layout — the original rules are written against the 12-column grid and weren't re-derived; whether the visual system as built matches the design's tokens and type scale — not audited, that needs the running application, not a file read.

**Known, logged, unresolved design/implementation tension:** the UI Blueprint argued that a transcript invites the room to debate response quality, and the implementation now has one. The replacement was instructed and isn't re-litigated here, but the risk the section names is real, and the Presentation Flow still carries the only mitigation — the presenter redirecting once, firmly.

**Replaced before implementation, left as-is:** the Demo Design's five-screen structure and left-rail navigation, and its 12–15 minute run order (against the Presentation Flow's 10:00). These were replaced during design, not by the build, and both documents already cross-reference the change. Rewriting them would erase design history for no factual gain.

## See also

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — the consolidated, up-to-date project status.
- [`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) — the philosophy and design decisions referenced here.
- [`HISTORY.md`](HISTORY.md) — the full chronological development history.
