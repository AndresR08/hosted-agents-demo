# Design decisions

This document consolidates the philosophy, positioning, and design decisions made during the development of this demo. It is a technical document aimed at anyone joining the project as a developer or designer: it explains not just *what* was built, but *why*, including a real course correction that is worth understanding before touching the code.

---

## 1. Design philosophy and principles

### 1.1 Role and original context

The application was designed from the perspective of a Microsoft Cloud Solution Architect, for the `labs/ai-foundry-hosted-agents-custom-framework` lab, with a deliberately enterprise audience: banking, insurance, healthcare, retail — regulated sectors where the security review, not the business case, is what kills an AI proposal.

### 1.2 What's actually being sold (and the later correction about this)

The original design thesis argued that the customer isn't buying an agent — any vendor can show a chatbot answering a question — but rather **the ability to put agents into production without losing control over them**. The idea to convey was:

> Between the user and the model, and between the agent and the model, there is a control point the enterprise owns. No credential reaches the client. No credential reaches the agent. Every call is logged. Every agent is versioned, attributable, and runs with least privilege.

In the original formulation, the dual-gateway pattern (API Management appearing twice in a single request) was not an implementation detail to hide away — **it was the product**, and the demo was built around making it visible.

That specific claim — "that's the product" — turned out to be the project's initial focus error. Section 2 of this document tells the full story: why that decision was made, why it wasn't unreasonable, and why it was corrected to "Foundry first, gateway second." The rest of this section 1 (principles, data-honesty bands, local-host architecture) still stands unchanged; what changed was *which* protagonist sits at the center of those principles, not the principles themselves.

### 1.3 Guiding design principles

| Principle | Consequence for the application |
|---|---|
| **Truth over polish** | Every number carries a labeled provenance. Nothing is invented. Where the lab cannot show something, the application says so on screen. |
| **One idea per screen/surface** | Every region of the interface has a single headline; an executive should be able to summarize its conclusion in one sentence. |
| **Progressive disclosure** | Executives see the conclusion. The enterprise architect in the room clicks "show detail" and sees the live policy XML, the RBAC table, the raw JSON. Both audiences are served without cluttering the main view. |
| **Live where it matters, honest where it doesn't** | Security and governance screens are 100% live — that's where skepticism lives. The cost screen is explicitly illustrative and visually marked as such. |
| **Demo-safe by construction** | Nothing that takes more than ~15 seconds runs live during the session. Deployment, image builds, and agent registration all happen before the customer is in the room. |

### 1.4 What this application is NOT

- **It is not a developer tool.** No code editor, no request builder, no schema explorer, no "try the API."
- **It is not an operations console.** It does not replace the Azure Portal and must not pretend to be a production monitoring product.
- **It is not a chat product.** The conversational surface exists only as evidence that the platform works.

### 1.5 Audience map and the five questions

| Persona | Their question |
|---|---|
| CIO / CDO | Can we actually take this to production? |
| CISO / Security architect (the critical persona) | Where do the credentials live? |
| AI lead / platform owner | How do I manage fifty of these? |
| Enterprise architect | Show me the real path. |
| Risk / Compliance / Model risk | What gets logged, and what can I show the regulator? |
| FinOps | How much does this cost per department? |

The CISO is the critical persona: in regulated industries, an AI platform proposal dies in the security review, not the business case. This is what justifies the Access and Identity block getting the largest time budget in the script (see §5).

The application must answer, in order, five questions: does it work? · what's happening right now? · is it secure? · can I control my AI agents? · why is this valuable?

### 1.6 The data-honesty band system

This is the central mechanism governing every claim the application is allowed to make: an honest inventory of what this specific lab can and cannot produce. Every data element on screen is classified into one of three bands, and every data component carries a visible provenance badge — **there is never an unlabeled number in the application**.

| Band | Meaning | Visual treatment |
|---|---|---|
| 🟢 **LIVE** | Real Azure data, retrievable in seconds, trustworthy in a demo | "Live" badge with timestamp |
| 🟡 **LIVE — DELAYED / VERIFY** | Genuinely real, but subject to ingestion latency or pending confirmation during rehearsal | "Live · delayed" badge showing data age |
| 🔴 **NOT AVAILABLE** | Cannot be obtained from this lab. Omitted or shown as a clearly labeled illustration | Visually distinct panel, with an explicit "Illustrative" label |

**Golden rule: no solution is ever invented for what falls in the red band.** Every unavailable element is either omitted or explicitly declared as an illustration.

#### What is genuinely 🟢 live

Agent response text and end-to-end latency; HTTP status codes under varied credentials; the API Management policy XML read live from ARM; the managed identity's object ID and audiences; the agent's name/version/status/image/CPU/memory/environment variable keys; Azure Container Registry repositories, tags, and digests; resource inventory; model deployment configuration and its RAI policy; diagnostic settings configuration.

An important finding, the result of a full telemetry audit conducted on 2026-08-02, **reclassified several elements from "not available" to genuinely live** — each verified by querying the deployed workspace directly:

- **Token counts** (prompt, completion, total) — populated at the inference hop (the model call), independently corroborated by the agent container's own OpenTelemetry instrumentation (exact matching values, e.g. 423/643 from both sources).
- **Per-hop gateway timing** — two rows per interaction, one per API. The gateway's own processing cost (`TotalTime − BackendTime`) turned out to be **1–5 ms** against multi-second requests: the direct answer to "won't a gateway slow us down?"
- **Distributed tracing** — 7 to 10 real parent/child spans across the Foundry runtime, the agent container, and API Management, including managed identity token acquisition as its own span.
- Exact model version, correlation IDs, agent session ID, server runtime versions.

#### What is 🟡 live but delayed or pending verification

Request count, success rate, and latency percentiles from Application Insights (1–3 minute ingestion delay); status code distribution; prompt and completion text logged in Log Analytics (`ApiManagementGatewayLlmLog`) — verified that the prompt is indeed captured, but in at least one check the completion field arrived empty, so the application prints "(not captured at the gateway for this request)" instead of inventing one; correlation between the two gateway hops in a single distributed trace (the agent does propagate `traceparent`, but the north-south API Management hop has no diagnostics configured in Application Insights, so the two hops are associated by time window and the UI labels it as an approximation, not a single measured transaction); tool-execution visibility (`get_weather`) — execution is real and container logs do reach Application Insights, but at audit time no tool-call span had been observed because no rehearsal question had triggered one; SSE streaming through API Management (gateway buffering can affect token-by-token rendering); content-filter rejection (real, because the `Microsoft.DefaultV2` RAI policy is attached, but discouraged by default in an executive setting).

#### What is 🔴 not available — and why

| Cannot be shown | Why | Decision |
|---|---|---|
| Real cost/spend | Azure Cost Management has 8–24h latency; a demo resource group is too young | Illustrative panel, labeled as a public pricing model, not an invoice |
| Chargeback by department/consumer | The lab deploys a single API Management subscription | Do not simulate multiple departments; present as an architectural capability. Provisioning 2–3 extra subscriptions before the demo would make this genuinely live (recommended) |
| Rate limiting / throttling in action | No policy contains `llm-token-limit`, `azure-openai-token-limit`, or `rate-limit-by-key` | Do not simulate a throttling event; present in the Controls Catalog as "available at this policy point, not enabled in this deployment" |
| Semantic caching | No caching policy, no Redis | Controls Catalog only |
| Load balancing / circuit breaker in action | The inference bicep supports a pool, but the main bicep only passes a single AI service, so the pool is never created | Controls Catalog only |
| Historical trends (7/30/90 days) | The resource group is new, no history exists | No trend lines anywhere |
| Uptime / historical SLA | No operational history | Omit entirely |
| Private networking / network isolation | `publicNetworkAccess: 'Enabled'` on the Foundry and ACR accounts | Controls Catalog only, as a gap |
| Multi-region failover | Single region (`swedencentral`), Basicv2 SKU with no zones | Omit |
| Foundry evaluations, red teaming, security scorecards | The lab does not configure any of these even though the README mentions them | Do not build an evaluations screen; fabricating an evaluation score to a model-risk team at a bank would be actively harmful |
| Agent autoscaling under load | No load generation, no scaling telemetry exposed | Omit |
| A second agent framework competing live | The lab registers one agent at a time | Pre-register both agents (`strands-agent` and `pydantic-agent`) before the demo — recommended, but not done at the first check on 2026-08-01 |
| Full RBAC role-assignment table | **Reclassified from 🟢 on 2026-08-01.** `az role assignment list` returns empty under the presenter's identity, which lacks the `Microsoft.Authorization/roleAssignments/read` permission at the resource-group level | Do not present as live. The RBAC design is real and documented, but it must appear as a documented configuration claim, never with a "Live" badge |

This last reclassification (RBAC from 🟢 to 🔴) and the reverse reclassifications of tokens/timing (from 🔴 or 🟡 to 🟢) are the evidence that this band system is taken seriously: claims get adjusted whenever live verification contradicts the original assumption, in either direction.

**The resolution for the entire "not available" column is the Controls Catalog**: instead of fabricating telemetry, an honest two-state inventory — *active in this deployment* versus *available at this control point, not enabled* — that cannot be contradicted by anyone who later reads the configuration, and that enterprise architects find more persuasive than a fake 429. The contents of this catalog are detailed in §4.

### 1.7 Live / Replay mode: a safety net, not deception

A persistent two-mode toggle was designed:

- **Live** — every call is real, against the running deployment.
- **Replay** — every screen renders from a capture recorded during rehearsal against that same real deployment.

Replay mode preserves honesty: the badge changes on every panel, simulated content is never presented as if it were live. It protects against venue wifi, a cold agent, or an expired token, and ensures the demo never fails in front of a customer. Every component must render correctly in both modes.

**As built, there are two deviations from the original design:**

1. The modes are labeled **"Azure Live"** and **"Simulation"** in the Settings drawer, not "Live / Replay," and the toggle lives in Settings and in the presenter menu (`L`) rather than a visible switch in the header.
2. **Simulation renders hand-written simulated content, not a rehearsal capture.** The honesty property is preserved — panels still switch badges and nothing simulated is presented as live — but the claim of "captured against that same real deployment" isn't true yet. Recording a real capture remains outstanding.

### 1.8 Why this cannot be a pure browser app

Two hard lab constraints force a specific architecture:

1. **CORS.** Neither the API Management gateway nor the Foundry project endpoint emit CORS headers for an arbitrary browser origin. A direct `fetch()` from a browser page to either one fails — including, critically, the "the direct call bypasses API Management" comparison, which is one of the demo's strongest moments.
2. **Credential handling.** The API Management subscription key and the presenter's Entra token must never be embedded in client-side script, not even for a demo.

**Design decision:** the application runs as a **locally hosted presenter application** — a lightweight process on the CSA's machine that holds the Entra context (`az login` / `DefaultAzureCredential`), reads the deployment outputs, brokers every call to Azure, and serves the UI to the browser or projector. The client never needs their own Azure subscription, and no secret ever leaves the presenter's machine.

This materialized as two separate processes: `broker/` (Express/TypeScript, holds the Entra context, reads `broker/.env`, brokers every Azure call) and `demo-app/` (Vite/React, the UI served to the browser). No original lab file (notebook, Bicep, policies, `src/`) was modified; all new work is additive.

Additional, equally binding constraints: every component must render correctly in both modes (Live and Replay); no scroll at 1920×1080, with graceful compression down to 1366×768 (a common boardroom resolution); Foundry SDK calls need `allow_preview=True`; nothing that takes more than ~15 s can run live during the session.

---

## 2. Evolution of the product positioning

This section deliberately and honestly documents a real course correction in the project: from "the dual gateway is the product" to "Foundry first, gateway second." The fact that there was an early focus error is not hidden — it's valuable information for whoever continues the project, because the reasoning behind both the mistake and the correction remains relevant to future decisions.

### 2.1 The original thesis

At the project's first milestone, the "business problem" section of the project context stated in plain words that the lab's answer was a **dual-gateway pattern**, and closed with the line: *"That's the product. Everything else on screen supports it."* That sentence, written early and never reevaluated, ended up steering every subsequent design decision: Request Journey became the hero panel, Access Control received the largest time budget in the script, the line "two control points, not one" became the demo's thesis, and the most highlighted observability figure was API Management's latency overhead.

**Was this an unreasonable mistake?** Not entirely, and the distinction matters:

- **Defensible:** the parent repository is `AI-Gateway`, and its README bills itself as "APIM ❤️ AI Foundry." An API-Management-centered focus isn't foreign to that material, and the east-west hop (agent → API Management → model) is structurally real — the agent's `AZURE_OPENAI_ENDPOINT` does in fact point to API Management.
- **Accidental:** the single component the lab itself marks as **optional** (`main.bicep:33` — `enableHostedAgentResponsesApi bool = false` by default) got elevated to "the product," and no one ever asked what makes *this* lab different from the other labs in the same repository. The API Management control-point story is, to a large extent, common across that entire repository. Custom frameworks running on Foundry Hosted Agents is what's distinctive about this particular lab, and that's the part that got treated as supporting cast.

### 2.2 The self-critique: the positioning audit

A positioning review, conducted by rereading the root lab README, the `src/frameworks/` README, the notebook's own markdown cells, and `main.bicep`, arrived at one unambiguous central finding:

> **We built the demo around API Management. The lab is about Foundry Hosted Agents running custom frameworks.**

The evidence: the frontmatter and title of the lab README speak of "AI Foundry Hosted Agents with Custom Frameworks"; the six reasons the README itself gives to justify the lab (§Why) are, all six, properties of Foundry — none belong to API Management; and the notebook describes the lab as deploying "a custom framework agent."

#### The lab's six value propositions, evaluated honestly

| # | Lab's claim | What we were showing | Verdict |
|---|---|---|---|
| 1 | Built-in observability, tracing, and monitoring | Full trace, tokens, per-hop timing, GenAI attributes | ✅ Exceeded — we demonstrated it better than the lab itself |
| 2 | Agent identity and RBAC by default ("least privilege... instead of embedded secrets") | Managed identity span as evidence; RBAC table not retrievable | ⚠️ Weak, and uncomfortable (see §2.3 below) |
| 3 | Foundry guardrails and governance | Only model-level RAI policy | ⚠️ Partial — *agent*-level Foundry guardrails aren't configured in this lab |
| 4 | Discovery via Agent365 | Nothing | ❌ Absent |
| 5 | Native evaluation and risk testing | Nothing | ❌ Absent, correctly so — fabricating evaluation scores would be harmful |
| 6 | Control plane and platform operations | Immutable versions, image digest (buried in a dialog) | ⚠️ Partial and under-exposed |

The result: roughly **1.5 out of 6** on the reasons the lab itself gives for existing — while scoring very highly on a seventh value proposition (gateway governance) that the lab itself doesn't highlight.

#### The uncomfortable case: agent identity versus the plaintext key

The lab's reason #2 is specifically "least-privilege access to downstream Azure resources via RBAC **instead of** embedded secrets." This implementation does exactly the opposite on its most visible path: the API Management subscription key is injected into the agent container as a **plaintext environment variable**, and the Strands agent even exposes a `show_internal_environment_variables` tool that would hand it back to any caller. The application was already honestly disclosing this, which is correct — but the positioning consequence is subtler: **the agent's own outbound hop is the only hop in this architecture that doesn't use Agent Identity**, and the "dual gateway" framing turned exactly that weakness into the centerpiece, celebrating as a differentiator the very hop that, by the lab's own value system, is the one not yet done correctly.

The stronger, more lab-aligned version is: *"the agent currently holds a gateway subscription key; the Foundry Agent Identity it already has is what will replace that key, and here's the RBAC model waiting for it."* That's both more accurate and more useful to an architect. The proposed correction isn't to hide the key, but to reframe the east-west hop as **a migration path toward Agent Identity**, not the final destination.

#### Panel-by-panel review (summary)

The audit examined every existing panel against what the lab actually teaches. The recurring findings:

- **AI Assistant** explained the gateway architecture better than the agent runtime — an accidental divergence, fixable by rebalancing the knowledge base toward the runtime and surfacing container provenance in every answer.
- **Request Journey** ended on gateway latency, when the lab's own payoff for that same diagram is **agent routing by URL path** (one API Management API serving N agents) — the URL was never shown.
- **Access Control** only showed the direct path *failing*, when the lab documents it as the troubleshooting baseline that **should succeed** with an Entra token — a diagnostic tool got inverted into a security scare.
- **Active Agents** told half the story: that frameworks are interchangeable under the same governance, but never that they are **specifically different** — which is the whole reason the lab supports custom frameworks. Flagged as **the single biggest missed opportunity in the entire application**.
- **Observability** was strong, but its headline KPI was gateway overhead (an API Management metric) on an *agent* observability panel; the cross-runtime trace comparison (Strands shows spans from its event loop, Pydantic AI a flat trace) was already captured and never shown.
- **Controls/Governance** listed almost exclusively API Management controls; Foundry-side governance (Agent Identity, agent RBAC, evaluations, red teaming) was barely represented.
- The **application's name**, "Enterprise AI Gateway," staked out the positioning from the very first second — the lab is called "AI Foundry Hosted Agents (Custom Frameworks)."
- The application offered **no bridge back to the notebook**, which is the real reproducible artifact and the lab's official starting point.

**What this same audit says to keep unchanged**: the honesty architecture (observable fields, provenance, the active/available/not-configured split, the refusal to fabricate evaluation scores); the observability pipeline; the three-way credential test and the live policy viewer; the two registered, switchable agents; and the presenter tools.

### 2.3 The correction: "Foundry first, gateway second"

The course correction, dated 2026-08-03, was articulated across three successive documents, each explicitly built on the previous one:

1. **`PRODUCT_POSITIONING_REVIEW.md`** — the diagnosis (summarized above).
2. **`PRODUCT_REDESIGN.md`** — the first redesign proposal, working panel by panel. It was **superseded** the same day by the next document, and is kept only as history — where the two disagree, the later document wins.
3. **The product experience architecture** — the definitive document, "the one to build against," detailed in section 3 of this document.

The project context was explicitly corrected: the phrase "that's the product" was removed, not softened. The dual-gateway material itself is accurate, well built, and stays on screen — what changes is the claim it carries:

> **The product is the first sentence; the gateway is the second.** Foundry turns the agent into a managed asset; API Management is the perimeter around it. A demo of the perimeter is not a demo of the asset — which is what the application had become, and what this correction fixes.

The line the customer should walk away with, restated:

> *"I can build agents with whatever framework my teams prefer, and Azure gives me a single platform to deploy, govern, observe, and operate all of them."*

#### Foundry's role, in business terms

Foundry is **the platform that turns a team's agent code into a managed corporate asset**:

| Business need | What Foundry does | Evidence in this lab |
|---|---|---|
| "I don't want to rewrite our agents to fit a vendor's runtime" | Runs **your container**, unchanged, behind a standard contract | Responses protocol v1.0.0; two different SDKs, same contract |
| "I need to know exactly what's running in production" | **Immutable versions** — publishing creates `:2`, never mutates `:1` | `pydantic-agent` is already at `:3` |
| "I need to prove which build answered which request" | Version pinned to an **image digest** in ACR | Real digest, real push timestamp |
| "I don't want one more thing to operate" | Foundry owns the **hosting lifecycle, scaling, health, routing** | Documented in the Strands framework README |
| "Every team instruments differently and I can't compare anything" | A single telemetry model **regardless of framework** | Both runtimes emit GenAI OpenTelemetry spans to the same workspace |
| "Secrets everywhere" | Agents get an **Agent Identity** for RBAC to downstream resources | Partially realized in this lab — see §2.2 |

#### API Management's role, in business terms

API Management is **the enterprise boundary around those assets** — important, structural, but not the protagonist:

- Consumers hold **a single subscription key**, never an Azure credential — onboarding a consumer means issuing a key, not provisioning an identity.
- The gateway performs **credential exchange per request** — managed identity tokens, minted on the fly, never stored, on both hops.
- **One API serves N agents** by URL route — the tenth agent changes nothing.
- Full prompt/completion capture and token measurement at a point the platform team owns.
- All of this for **1–5 ms**, measured.

And the honest limit, straight from the lab itself: `main.bicep:33` sets `enableHostedAgentResponsesApi = false` by default, and both framework READMEs call the API Management integration "optional." The lab works without the north-south gateway. That doesn't make API Management irrelevant — it makes it **the enterprise layer that gets added on**, which is a better, more sellable story than "the thing without which nothing works." The proportion target: API Management should own roughly **one act out of five** and one dashboard panel — not the hero slot, not the largest time budget, not the headline metric.

### 2.4 Practical consequence: what stays, what changes, what's removed

**Stays unchanged:** the broker and all Azure integration (endpoints, correlation model, telemetry queries); the honesty architecture (observable fields, provenance badges, the three-state governance split); the observability data layer (cross-validation of tokens, per-hop timing, distributed tracing); the three-way credential test and the live policy viewer; the presenter tools (guide, maintenance diagnostics, keyboard model, Simulation mode); the natural-language assistant and its knowledge base (only the content *balance* shifts toward the runtime).

**Changes:** the application name and the landing-page framing, to lead with Foundry; the agents panel, elevated to a hero surface with capabilities and positioning for each framework; Request Journey, re-centered on the container, naming the protocol and the routing; Observability, which absorbs the controls catalog, leads with agent metrics, and adds the cross-runtime comparison; Access Control, reduced, plus the authorized direct path; the assistant, with answers sealed with container provenance and a rebalanced knowledge base.

**Removed:** the Controls panel as a standalone surface (merged, content not discarded); the claim "the dual-gateway pattern... is the product"; "two control points, not one" as a permanent Journey subtitle (it stays as a presenter talking point, not a fixed label); the top position of gateway overhead in the Operations KPI order (the metric stays, its position drops).

**Explicit warning against overcorrection**, logged in the redesign process itself: don't demote the gateway material out of spite toward the diagnosis — it's the strongest content for the persona who can veto the deal (the CISO), and the goal is to stop *claiming* it's what the lab is about, not to spend less time on it. Nor should any framework difference be fabricated that doesn't exist in the source code, nor should Agent Identity be simulated on the model hop — both agents explicitly document that they use API-key authentication, not managed identity, for model calls; the honest version ("this is where Agent Identity would replace the key") makes for a better architecture conversation than a false claim.

---

## 3. Product experience architecture

This is the definitive document — the one to build against. Its lineage is clear: the positioning audit is the diagnosis, the first redesign is the initial proposal (superseded), and this is the current product definition.

### 3.1 The narrative in five acts

The application tells five acts, with the agent as the protagonist throughout and the customer's own work visible from the first act:

1. **"That's my agent."** The application opens on the agent the customer registered: name, immutable version, the image digest they pushed, the framework they chose, running. Ask it something and it answers. Recognition is immediate and personal.
2. **"And this one is nothing like it."** There's a second agent: a different framework, with genuinely different capabilities — different tools, different handling of conversation history, one accepts images and the other doesn't. It's not a variant — it's different software.
3. **"Neither one had to be told anything about governance."** Both cross the same policy enforcement point. No container holds an Azure credential. Routing is by URL path, so a tenth agent needs no gateway changes. Four lines of policy achieve this, and the customer can read them, live.
4. **"And I didn't instrument anything."** Both runtimes land on a single operational surface. Same token counting, same traceability, same audit log. The traces even reveal their different internals — Strands shows its agent loop, Pydantic AI shows a flat call — which is the proof that the platform didn't need to know what was inside.
5. **"So here's what I have."** What's enforced today, what the control point offers that isn't switched on, what a production hardening pass would add. Configuration, not a rebuild.

That is the lab README's own "§Why" section, in order, experienced rather than read. The line the customer should remember is the same one quoted in §2.3.

**A nuance on narrative order:** the proposed flow is not a single agent that introduces a second one late, but **two teams, two frameworks from the premise** — establishing plurality as the starting point makes every following step demonstrate convergence instead of merely describing it.

### 3.2 Why the frameworks exist — and how they actually differ

This is the biggest deficit identified: the lab's whole reason for being, and where the application was nearly silent. Both framework READMEs answer "why would I choose this," and neither had ever been surfaced:

- **Strands** — an open-source toolkit focused on building production agents with model/provider flexibility, built-in context management, execution limits, observability, and hook-based runtime control. Good fit for tool-heavy workflow automation, for steering runtime behavior with hooks, and when visibility and operational control of the agent loop are the priority.
- **Pydantic AI** — the agent is the primary abstraction: a container of instructions, tools/toolsets, structured output typing, dependency typing, model configuration, and reusable capabilities. Good fit when the shape and validation of output matters to downstream systems, when typed dependencies and static-checker feedback are needed, and for composing reusable behavior.

That's a real engineering-decision distinction — **runtime control versus type safety and output contracts** — exactly the kind of decision platform teams debate.

The real differences, verified directly against both frameworks' source code:

| Capability | Strands | Pydantic AI |
|---|---|---|
| Exposed tools | `get_weather` **+** `show_internal_environment_variables` | `get_weather` only |
| Tool execution | Strands's server-side agent loop | `@tool_plain` |
| Conversation history | Native `Messages`, `SlidingWindowConversationManager(20)` | **Flattened to a text prompt** (`"role: text"`) |
| Image input | **Supported** — inline `data:` URLs → raw bytes | Not implemented |
| Streaming | `agent.stream_async()` | `run_stream()` + prefix differentiation |
| Cancellation | Bound to `agent.cancel()` | Cooperative loop interruption |
| Observed trace shape | `invoke_agent → execute_event_loop_cycle → chat → chat gpt-5-mini` | Flat: `chat gpt-5-mini` |

**What the application should demonstrate — and explicitly should not:**

- **This is not a benchmark.** No "faster," no "better," no scores. The observed latency differences are model variance, not framework quality, and presenting them as quality would be dishonest.
- **Yes: they are different software.** Different capabilities, made visible.
- **Yes: Azure doesn't force a choice.** Both registered, both running, both reachable.
- **Yes: governance is identical.** Same policy, same identity model, same auditing, same telemetry shape — and no container had to be modified to get it.

The highest-value moment available for this demo, and the one that wasn't built: asking both agents the same thing and showing a capability one has that the other doesn't. That is the lab's thesis in a single interaction.

### 3.3 The five panel surfaces

Honestly interrogating the six existing panels with the question: *does this make a lab capability visible, or does it exist because we kept adding things?* — the Controls panel turned out to be the clearest artifact of "we added it because we were adding things": it duplicated the Governance tab of the Observability panel, which does the same job with per-request evidence. Removing it costs nothing and frees up the space the frameworks story needs.

The resulting structure — six panels become five, named for what they teach rather than the Azure service behind them:

| # | Surface | Answers | Replaces |
|---|---|---|---|
| ① | **Your Agent** | Is my container running, and does it work? — the conversation, always sealed with which container, framework, and version answered | AI Assistant |
| ② | **Frameworks** *(hero)* | Why two, and what actually differs? — both agents side by side: framework positioning, version, image digest, protocol, declared tools, capability matrix, live status | Active Agents, expanded |
| ③ | **Request Path** | How does a request reach my container, and what does the platform add? — Responses protocol, path routing, the two governance hops with their measured cost | Request Journey, re-centered |
| ④ | **Enterprise Boundary** | Who can reach it, and on what terms? — the three credential outcomes, the authorized direct path, the four-line policy, live | Access Control, reduced |
| ⑤ | **Operations** | How do I operate a fleet of these? — cross-runtime telemetry, tokens, traceability, audit log, and the governance catalog across **both** planes | Observability + Controls merged |

### 3.4 Capability inventory

Summary of what the application demonstrates against what the lab actually offers (legend: ✅ demonstrated · 🟡 partial · ❌ the lab names it but doesn't implement it · 🚧 implementable with extra work on top of what's already deployed):

**Foundry Hosted Agents (the platform):** the Hosted Agent concept 🟡 (name and version shown, the idea never visually explained); the Responses protocol v1.0.0 🚧 (never mentioned in the UI, despite being the contract that makes any framework pluggable); the ACR image supply chain 🟡 (digest and timestamp exist, buried in a dialog); immutable versioning 🟡 (`:3` visible, the immutability property never made explicit); `az acr build` with no local Docker 🚧 (a real benefit for the practitioner that the README highlights); the deploy/register flow ❌ as an app capability (it happens in the notebook; the app shows no trace of it).

**Framework runtime (the lab's subject):** two frameworks coexisting ✅; why each framework exists 🚧; capability differences between frameworks 🚧 (tools, history, image input — all real, all in the source code, none shown); tool calls 🚧 (both expose `get_weather`, never exercised); image input (Strands only) 🚧; multi-turn with `conversation_id` 🚧; SSE streaming 🚧.

**Governance and identity:** live API Management policies from ARM ✅; managed identity on both hops ✅; credential enforcement (401s) ✅; multi-agent routing by path 🚧 (architecturally real, never shown); Agent Identity for downstream RBAC 🟡/❌ (Foundry grants it, but both agents document using an API key for model calls — real as a Foundry capability, not exercised on this path); RBAC role assignments ❌ (not retrievable with the presenter's identity; documented design only, never a live claim); Foundry agent-level guardrails ❌ (only the model deployment's RAI is configured).

**Observability and operations:** token measurement ✅; per-hop gateway timing ✅ (1–5 ms measured); distributed traceability ✅ (7–10 real spans); cross-runtime trace comparison 🚧 (collected, never exposed — the best available proof of the lab's value proposition #1); Application Insights / Log Analytics 🟡 (used constantly, never named on screen); full audit logging ✅; cold-start/scaling behavior 🚧 (8–17 s measured).

**Named by the lab, not implemented by it (declare as platform capabilities, never as demonstrations):** discovery via Agent365 ❌; evaluations/red teaming ❌ (correctly absent — fabricating a score for a model-risk audience would be actively harmful); cost estimation flows ❌.

**Summary:** of the lab's six own value propositions, **one** (observability) is fully demonstrated, **three** are partially demonstrated, and **two** cannot be demonstrated without inventing things — which won't be done.

### 3.5 The acceptance test

A Microsoft architect who just ran the notebook opens the application and, unprompted:

1. sees **their own agent** — name, version, image — within five seconds;
2. sees the **second framework** and can state one real difference between the two in a sentence;
3. understands that **no container was modified** to get governance, identity, or telemetry;
4. can read the **four lines of policy** that make it enforceable;
5. knows **what it would take** to run this in production;
6. can **go back to the notebook**.

When all six hold, the target line arrives on its own: *"Yes. This demonstrates exactly what the lab is worth."*

---

## 4. Visual design system (UI)

### 4.1 The organizing metaphor: a stage, not a dashboard

A dashboard is a surface you *monitor*. A stage is a surface you *direct*. The application is a stage: the page doesn't sit there showing everything at once — it starts quiet, and components light up in sequence as the presenter drives the story. The audience's attention is guided, not scattered. That single decision is what lets one page carry a five-act narrative without turning into an information dump.

Everything else follows from that: components have **states**, not just content; the layout order **is** the argument's order; and nothing is visible before it's relevant.

**What "premium Microsoft product" means here:** not chrome, not gradients, not a hero image. It means: **confidence** (generous whitespace — a product that needs to fill every pixel is a product unsure of its own value); **restraint** (a single accent color, two elevation levels, no decorative motion); **precision** (a strict type and spacing scale, optical alignment); **honesty** (every figure carries provenance, no unlabeled number); **calm** (nothing blinks, spins, or pulses unless doing so communicates something). The reference point is Microsoft 365 admin surfaces and Fluent 2 — clean, typographic, low-saturation — **not** the Azure Portal; the visual language must say exactly that within the first second.

**Design evolution note:** the original design proposed five sequential screens. It was decided that a single page is the better instrument for a ten-minute session — navigating costs seconds, breaks eye contact, and gives the audience a chance to "reset." All five acts survive intact; they become **regions of one page, revealed in order**, rather than separate destinations. This "single page" decision is independent of — and predates — the positioning correction described in section 2; what changed afterward wasn't the single-page principle, but which region occupies the hero slot.

### 4.2 Component decisions: what stayed, what was cut, what was added

| Component | Original verdict | Reasoning |
|---|---|---|
| Chat | Keep, radically reduced to "Ask": one question, one answer, no transcript | A chat invites the audience to judge the model response's quality — a commodity conversation that can't be won in a boardroom |
| Request Journey | Keep, promoted to hero (in the original design) | The dual-gateway pattern was, at the time, "the product" — see section 2 on how this reasoning changed |
| Governance Summary | Keep, reframed as "Controls": active vs. available, instead of a vague "summary" | A concrete inventory is more persuasive than a generic claim |
| Active Agents | Keep, small in the original design | "Two frameworks under one governance model" is a powerful fact — it's a *fact*, not a dashboard, and should have been sized as such |
| Azure Resources Status | **Remove** | Recreates the Azure Portal (explicitly forbidden); no executive value; invites going off-script; telemetry for a freshly created resource group tells no story |
| Recent Requests | **Remove** — one thing salvaged | A request log is a developer artifact and the component most likely to embarrass live (Application Insights has a 1–3 min ingestion delay, so during the demo it will be empty or stale exactly when the presenter points at it). What's salvageable: the **audit log** — a real prompt and completion captured at the gateway, the artifact a bank's compliance function actually wants |
| Demo Controls | Keep, nearly invisible | Necessary (Live/Replay, reset, agent selection) but corrosive if visible — a panel labeled "Demo Controls" tells the audience they're watching a demo, not a system |
| Access Control | **Added**, not on the original candidate list | The single most important component on the page: the three-way credential test is the moment a skeptical CISO changes posture, it's 100% live and visually unambiguous |

### 4.3 Layout composition, as built

The original design specified a 12-column grid stacked top to bottom. During implementation, on the presenter's explicit instruction, this was replaced with a **two-column composition**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER — product brand · region · resource count · ● Live                │
├────────────────────────┬─────────────────────────────────────────────────┤
│                        │  REQUEST JOURNEY                     (hero)     │
│  AI ASSISTANT          ├──────────────────────────┬──────────────────────┤
│  ~35%, full height     │  ACCESS CONTROL          │  AGENTS              │
│  multi-turn            ├──────────────────────────┼──────────────────────┤
│                        │  AUDIT RECORD            │  CONTROLS            │
└────────────────────────┴──────────────────────────┴──────────────────────┘
```

Two deviations from the original design, both by the presenter's explicit instruction, neither of which changed the architecture, the service-layer separation, or the "no Azure in the browser" boundary:

1. **Layout** — the vertically stacked 12-column grid became the two-column composition above (AI Assistant at ~35% on the left, full height; the stacked visualizations at ~65% on the right).
2. **Ask → AI Assistant** — the deliberately single-turn "Ask" became a persistent multi-turn assistant, with scrollable history, per-message timestamps, and suggested scenarios. The risk the original design wanted to avoid (the room debating response quality) remains real, and the presenter still has to manage it verbally.

The original single-column composition's vertical budget fit comfortably at 1080 px tall; the two-column layout keeps the same "no page scroll" rule by pinning the outer container to the viewport, with a single intentional exception: the assistant's message history scrolls within its own panel.

Later, the product experience architecture (§3.3) redefined which region occupies the hero slot — from Request Journey to Frameworks — and merged Controls into Operations. See §2.4 and the note in section 5 on the status of this migration.

### 4.4 What each surface must demonstrate (functional summary)

Each component was originally specified against nine attributes (purpose, position, size, information shown, Azure resource, live/simulated, refresh cadence, interactions, business message). The pixel-level details are omitted here; what follows is the purpose and business message of each, which is what survives any layout reshuffle:

- **AI Assistant (formerly Ask/Answer)** — prove that the platform answers and nothing more; it exists to earn the right to talk about governance for the rest of the session. Business message: *"This is a running system, not a slide."* In Live, every message is a real round trip API Management → Foundry → API Management → `gpt-5-mini`; suggested prompts always send a scripted question but always render the agent's real response — canned response text only exists in Simulation mode.

- **Request Journey / Request Path** — make the dual-gateway architecture visible and intuitive. Five nodes on a horizontal trace (Client → API Management → Agent → API Management → `gpt-5-mini`), each with a label and a one-line credential fact, lighting up in sequence as the request executes. Emphasis originally landed on step 4 (the agent doesn't call the model directly, it calls the inference gateway) under the "two control points, not one" thesis; the later experience architecture calls for re-centering the agent node and showing the URL-based routing path. Per-hop timing (🟡, subject to Application Insights delay) and internal agent processing (derived, never directly measured) must be explicitly labeled as such; if a rehearsal shows the two hops don't correlate within a single distributed trace, they're associated by time window and the UI marks it as an approximation, never as a single measured transaction.

- **Access Control / Enterprise Boundary** — prove security by demonstration, not by claim. Three live outcomes, run in sequence: with subscription key (200 OK), without a key (401, rejected at the gateway), direct to Foundry with no Entra token (401, rejected by Foundry). A "credential ledger" summarizes what the customer holds (one API Management subscription key, no Azure AD credential), what API Management adds (a managed identity token minted per request, audience `https://ai.azure.com`, never stored), and what the agent holds for model calls (an inference-gateway subscription key, not a model key). **Critical color inversion:** a 401 renders as an **affirmative** result, never as an error — a shield or lock icon, never a warning triangle; red appears nowhere on this page. It's the single most important semantic decision in the entire visual system. Business message: *"The customer holds one key. They never touch Azure."*

- **Active Agents / Frameworks** — move the conversation from one agent to a fleet, and defuse the vendor-lock-in objection before it's raised. Agent registry (name, immutable version, status, framework, resources), provenance chain (source → ACR image + tag + digest + push timestamp → agent version → running instance), identity and permissions (live RBAC table, when retrievable), configuration (environment variable keys, masked values), and guardrails (RAI policy read live). Business message: *"Your teams choose their framework. You keep one governance model."*

- **Controls / Operations (merged governance)** — turn "AI governance" from an aspiration into an inventory. Two columns: what's **active in this deployment** (verified live from the running configuration) and what's **available but not enabled here** (explicitly declared as not configured). The second column isn't a weakness — it's the roadmap, and presenting it honestly is worth more than a fabricated throttling event. Business message: *"You already own the control point. Turning this on is configuration, not a rebuild."*

- **Audit Record** — hand the compliance function the artifact it actually needs. A single real record captured at the gateway (`ApiManagementGatewayLlmLog`), shown in full rather than as twenty truncated rows. Business message: *"Every AI interaction across your organization is logged centrally — no matter which team built the agent or which framework they chose."* It's also the right moment to name, unprompted, that the lab logs at 100% sampling with full message capture — a data-governance decision the customer should make consciously.

- **Header (chrome)** — establish in a single line that this is real Azure infrastructure: region, resource count, resource group, connection status (Live with timestamp, or Simulation). Serves the legitimate need behind the removed "Azure Resources Status" panel at 1/40th the visual cost.

- **Presenter menu (chrome, nearly invisible)** — presenter instruments deliberately kept out of the audience's attention: the Live/Replay toggle (implemented as "Azure Live"/"Simulation"), reset to initial state, target agent selection, warm the agent, refresh telemetry. Driven primarily by keyboard shortcuts so the presenter never breaks eye contact.

### 4.5 Visual system: principles (not pixel values)

The exact typography and spacing values (Segoe UI Variable family, four font sizes, 4 px scale, 12-column grid with 24 px gutters and 48 px margins) are documented in the code and not reproduced here. What's worth preserving is the reasoning behind each decision:

- **Typography:** four sizes, nothing more — no weight below 400, because thin weights fall apart on projectors. The 16 px base body size is the "projector floor": never smaller.
- **Color:** a very light gray canvas, never pure white (pure white causes projector glare); a single accent color reserved for "live" status and primary actions; an "affirmative" color distinct from the accent, reserved for security rejections (401s); illustrative content in a visibly muted treatment, so the distinction survives even a photo of the screen. A dark variant is required, because boardroom lighting varies and that preference isn't ours to assume.
- **The color inversion** (already described in §4.4): a 401 in Access Control is success, not error. No red and no warning triangle appears anywhere on the page — there is no failure state meant to be communicated visually; a real outage falls back to Replay mode rather than rendering an error.
- **Elevation and shape:** only two levels (canvas and surface); cards defined by a 1 px border rather than a shadow — heavily shadowed cards read as a web template, thin lines read as a product.
- **Motion:** only where it communicates meaning — the sequential lighting of the Journey steps, the pacing of the Access Control test sequence, detail expansion. Nothing else moves: no skeleton shimmer, no pulsing dots, no spinner longer than one second (a spinner on a projector reads as a failure).
- **Provenance badges (non-negotiable):** every component showing data carries exactly one — `● Live · 14:32`, `◐ Live · delayed 2m`, `◑ Replay · 29 Jul`, `○ Illustrative`. This is the visual expression of the honesty principle from §1.6, and it's what lets the presenter stay relaxed in the face of a hostile question.

### 4.6 Page states

The page is a stage with four lighting states: **Opening** (load or reset — header and entry point at full presence, everything else dimmed, the page visibly "waiting"); **Executing** (an Ask fires — the Journey lights up left to right, the response streams in); **Resolved** (response complete — the answer, provenance, and per-hop timings settle in, the bottom band rises to full presence because the governance conversation is now available); **Interrogated** (any detail expanded — the expanded card rises, everything else recedes to 60%, one thing is being examined). The Opening state is what makes a single page work: the audience doesn't see the whole argument before the presenter has laid it out.

### 4.7 Constraints and degradation

**Not a developer tool:** deliberately absent are request builders, header editors, schema explorers, endpoint pickers, environment configuration, code samples, "copy as cURL," or response inspectors beyond a collapsed raw view.

**Not the Azure Portal:** no resource tree, no blades, no breadcrumbs, no per-resource-type icon set, no health grid. The visual language must not be mistaken for the portal at first glance — that confusion would make the application feel like a worse version of something the customer already has.

**Resolution degradation:** designed for 1920×1080 with no scroll; scales proportionally down to 1600×900; at 1366×768 (a common boardroom resolution) the Journey shrinks, the bottom band compresses, and the Audit Record collapses to an expandable summary line — but **there is still no scroll**; below 1366 there is no support, the presenter must use an adequate screen.

This rule has exactly one declared exception — the Gateway Reference tab, which is a document rather than a stage screen. See §4.9 for the exception and, more importantly, for the test that keeps it from spreading to a second screen.

---

### 4.8 The Gateway Credentials tab — measured twice, and it stays

**Status: RESOLVED at CP3 (2026-09-02). The tab stays. It was re-examined under the new chrome exactly as this section required, and the measurement below is why it is no longer provisional.**

**The re-examination, step by step, as §4.8 originally specified it.**

*Step 1 — re-measure under the sidebar's chrome.* The navigation rail removed
the 72px environment header and the 48px section row, taking the vertical
budget from 411px to 507px. The live Gateway screen, measured with real data
loaded, is 423px of content in that 507px budget: **84px of margin**. On its
own it now fits comfortably, which is precisely the condition that made the
question worth reopening.

*Step 2 — does the credential test fit back on the live screen, with real
margin?* **No.** Not estimated: the credential body was grafted onto the live
screen in a running browser and measured.

| | px |
|---|---|
| Live screen alone | 423 |
| Credential body + its section heading | 138 |
| **Merged** | **561** |
| Budget | 507 |
| **Hidden** | **54** |

And that is the credential test in its *empty* state. Once the three attempts
have run — the state the presenter is actually in when the 401 matters — the
body grows to 132px, so the merged screen hides **64px**. The rail's extra 96px
of budget is real, and it is still 64px short of what reintegration costs.

*Step 3 — decide neighbourhood rather than leaving it by default.* The tab
stays between **Live** and **Reference**, and that order is now deliberate
rather than incidental. Live and Credentials are both readings of this
deployment; Reference is not. Putting Credentials after Reference would place a
measured screen on the far side of the boundary that the dashed frame, the
banner and the pills exist to draw, which is the one arrangement the tab set
must not have.

**What this costs, still stated plainly.** The 401 rejection is one click away
rather than on screen. It is the most important beat in the gateway story and
the only green in the console. That has not stopped being a cost because the
measurement went against reintegration — it is simply a cost with no cheaper
alternative, and the honest thing is to mitigate it rather than pretend it away:

- The `S` shortcut runs the three attempts *and* navigates to this tab. That
  was broken by the original split — it set `stop` to `"gateway"` and so
  navigated away from the results it had just triggered — and was fixed when
  the bug was found by running it.
- The presenter guide should carry the Credentials tab as its own numbered
  beat, so it cannot be skipped by a presenter who forgets the tab exists.

**What would reopen this.** Not a preference, and not a redesign of the flow
diagram to buy 64px. Only a change that removes an argument from the live
screen for a reason of its own, or a resolution above 1366×768 becoming the
floor. Absent either, this is settled: it was measured twice, under two
different chromes, and both times reintegration did not fit.

---

<details>
<summary>The original provisional record, kept as written</summary>


Measured against the 1366×768 floor with the corrected probe (content height read
from `panel.firstElementChild.offsetHeight`, budget derived as `728 − (innerHeight
− panel.clientHeight)`), the live Gateway screen held **595px of content in a 375px
budget — 220px of it below the fold**, and therefore invisible to the room. It was
the worst-affected screen in the console, and unlike the others it could not be
reflowed into compliance: after every change that moved or tightened without
removing an argument, it still overflowed by 79px.

Gateway carried three arguments where every other screen carries one: *the
address* (the routed URL), *the path* (the flow diagram and its measured
timings), and *the terms* (which credentials the gateway accepts). Two changes
resolved it:

- **The address and the path merged under one heading.** Not provisional. They
  were always one argument stated twice — the URL says the agent name is a path
  segment, the diagram shows the request travelling that path — and two headings
  asked the room to hold apart two halves of a single point.
- **The terms became their own tab** (`gatewayCredentials`, between Live and
  Reference). This one *is* provisional.

**What the split costs, stated plainly.** Until now the 401 rejection was on
screen without the presenter navigating anywhere. That matters more than a
generic "one extra click": the 401 is the single most important beat in the
gateway story, and it is the only green in the entire console — `affirm` is
reserved for it and nothing else (§4.4, §4.5). A presenter who forgets the tab
exists will finish the gateway section without ever showing it. That is a real
regression in the demo, accepted for a real reason.

**Why it was accepted anyway.** The alternative was 79px of permanently hidden
content on the console's most argued-over screen, which is a worse failure: a
scrollbar at 1366 breaks §4.7 outright, and content below the fold is content the
room never sees at all. Between "one click away" and "invisible", one click wins.
It is also true that the credential test is already a separate beat in the
presenter script, so the tab does not cut across the narrative the way splitting
the address from the path would have.

**What to re-examine at CP3, specifically.** The sidebar restructure changes how
much vertical budget a screen has. When it lands:

1. Re-measure the live Gateway screen under the new chrome, with the same probe.
2. If the budget now accommodates the credential test back on the live screen
   *with real margin* — not the exact minimum; Platform and Agents both showed
   why a 0px margin is not a solution — then fold it back and delete this tab.
3. If it does not, ask instead whether the *reference* tab or the *live* tab is
   the better neighbour, and whether the presenter guide should make the
   credentials tab an explicit numbered beat so it cannot be skipped.

Do not conclude that the tab is correct merely because it is still there. It
solved a space problem on 2026-09-02; it was never argued for on its merits.

</details>

---

### 4.9 §4.7's no-scroll rule does not apply to the Gateway Reference tab

**Status: a declared exception, not an oversight. Exactly one screen is exempt.**

Measured at the 1366×768 floor with the same probe used everywhere else, the
Reference tab holds **1939px of content in a 409px budget**. Every other screen
in the console is at 0px hidden with real margin. This one is not, it never was,
and it is not going to be — which is a decision, and decisions of that size do
not get to live as a silent gap in a table.

**Why the rule exists.** §4.7 forbids scroll because the four stage screens are
things a presenter *speaks over*. Their content is a live reading of this
deployment — measured latencies, the routed URL, the credential outcomes, the
control catalogue — and the presenter is arguing from it in real time, to a room
that is looking at the projector rather than at the presenter's hands. Content
below the fold on those screens is content the room never sees, and the
presenter has no way to know it was missed. Scroll there is not an
inconvenience; it silently deletes part of the argument.

**Why it does not apply here.** The Reference tab is not a reading of this
deployment and is not spoken over. It is reference material about API Management
as a product: eight capabilities with a "used here" / "not in this lab" pill
each, the tier comparison, and the identity sequence. Three things follow from
that, and all three are the opposite of the stage screens' situation:

- **Nothing on it is live or time-sensitive**, so nothing is lost by being
  reached a moment later. Its one live value — the APIM tier — carries its own
  inline `live` badge and sits near the top.
- **It is read, not narrated.** The realistic use is a solutions architect
  opening it in answer to "what else can it do?", scrolling through it with the
  room, or sending a colleague to it after the session. That is a document, and
  documents scroll. Forcing 1939px of curated capability text into 409px would
  mean either cutting the catalogue down to what fits — making the platform look
  smaller than it is — or dropping below the 16px projector floor, which §4.5
  does not permit.
- **The honesty system does not depend on layout here.** The separation between
  reference and live is carried by the dashed `tone="reference"` frame, a
  permanent banner, a separate stop, and a per-capability pill (§4.8's neighbour
  screen and the component's own header comment). None of those weaken when the
  page scrolls; a pill scrolled past is not a pill that misleads, because it
  travels attached to the capability it qualifies.

**The boundary of this exception, stated so it cannot spread.** It covers the
Gateway Reference tab and nothing else. The test for any future screen claiming
it is not "is this screen long" but **"is a presenter arguing from live data on
it while the room watches?"** If yes, §4.7 applies in full and the screen must
reach 0px hidden with margin. Adding reference-style reading material to a stage
screen does not exempt that screen — it means the material belongs on a
reference screen instead, which is the whole reason this tab exists.

---

### 4.10 The KPI card — six real sources, no trend, and above all no cost

**Status: definitive. The exclusions below are the point of the section — a future contributor adding a cost or trend card would be undoing a decision, not filling a gap.**

CP4 adopted the Foundry IQ reference's KPI card shape on the one screen that
already had six real measurements to put in it: Observability → Measurements.
Icon, label, large value, mono sub-line. What it did **not** adopt is the part
someone will eventually try to add back, so this section exists to say why.

**No trend element.** The reference's card is built around a `+12%` slot.
§1.6 puts historical trends in the red band — the resource group is new, no
history exists, no trend lines anywhere — so that slot has nowhere to get a
real number from. A card designed around a trend, with the trend empty or
invented, is worse than a card designed without one.

**No cost card, and this is the important one.** The reference's headline card
is accumulated spend. Cost is in the red band too: Cost Management has 8–24h
latency and the resource group is too young to report on. A cost figure styled
identically to five live measurements would be the single most dangerous thing
in this entire adoption — it would inherit their credibility without their
evidence. If cost is ever shown, it belongs in an illustrative panel labelled
as a pricing model, never in this grid.

**The six that are real**, each printing the Log Analytics column it came from
in the card's mono sub-line:

| Card | Source |
|---|---|
| Latency | `ApiManagementGatewayLogs TotalTime` |
| Gateway | `ApiManagementGatewayLogs — TotalTime − BackendTime, both hops` |
| Model latency | `ApiManagementGatewayLogs TotalTime (inference-api)` |
| Total tokens | `ApiManagementGatewayLlmLog TotalTokens` |
| Prompt tokens | `ApiManagementGatewayLlmLog PromptTokens` |
| Completion tokens | `ApiManagementGatewayLlmLog CompletionTokens` |

That sub-line is the reason the card was worth adopting rather than a
decoration on top of it. Every field on this screen already arrives as
`{ value, source, available }`; the `source` was being fetched and then shown
only inside the detail dialog. Printing it under the number makes each figure
state where it came from, on the screen where the room is looking at it. It is
the honesty system gaining presentation, which is the only direction it is
allowed to move.

**Three across, not six.** Six tiles on the post-rail 1020px stage gave each
about 160px — already wrapping the labels, and with no room for a Log Analytics
column name. Three across gives ~330px, which fits one on a line.

**One tinted square, two glyphs.** §0.6 permits a tinted icon square and
restricts it to blue; three tints by category would reintroduce exactly the
colour overload the UX audit's F4 removed. The two glyphs — a timer for the
three durations, a number sign for the three token counts — encode a real
distinction in the data rather than decorating each card individually.

**An inaccuracy this change surfaced and fixed.** A field *absent* from the
payload and a field present with `available: false` are different facts, and
the band was telling the room the same thing about both. The second carries its
own accurate reason ("Cost Management cannot report on a resource group this
young"). The first simply has not been ingested yet — Log Analytics runs one to
three minutes behind — so "Unavailable in this deployment" was wrong about it,
and with six cards it was wrong three times at once. Pending fields now say
they are waiting for ingestion, which is what `HopWaterfall` directly below had
been saying correctly all along.

---

### 4.11 Platform's +28px of margin is borrowed from an i18n gap, and translating the control names will take it back

**Status: an open finding, deliberately not fixed here. This section exists so
that whoever translates the control names finds this before the layout does.**

Measured 2026-09-03 against the production bundle, at the 1366×768 floor, with
the same probe used in 4.8 and 4.9:

| Platform screen | content | budget | hidden | margin |
|---|---|---|---|---|
| Azure Live | 457px | 485px | 0px | **+28px** |
| Simulation | 536px | 485px | **51px** | −51px |

The Live number is the one recorded at CP2 ("28px of real margin instead of
exactly zero"). The Simulation number is new, and the first instinct — that
Simulation overflows because its placeholder data is bigger — is wrong. Live
shows *more* controls than Simulation (8 active + 6 available + 3 not-present,
against 7 + 6). It is the labels, not the count.

**The two modes read their control names from different places.** The live path
takes them from the broker, where they are hard-coded English strings
(`broker/src/routes/observability.ts`, `broker/src/routes/controls.ts`) that are
sent over the wire and rendered verbatim — they never pass through i18n. The
replay path takes them from `demo-app/src/i18n/translations.ts`, where they are
properly translated. So in a Spanish session the Live screen shows
"Subscription-key authentication" and the Simulation screen shows
"Autenticación por clave de suscripción, revocación por consumidor".

Measured: 31 characters average in Live, 54 in Simulation. At the 16px projector
floor that is the difference between control rows that fit on one line and
control rows that wrap to two, and across the catalogue it is 79px of content —
exactly the gap between 457 and 536.

**What this means for anyone changing it.** The Live path is the one that is
wrong: a Spanish UI showing English control names is an inconsistency with every
other surface in the console. But the fix is not local. Translating those names
is a one-line-per-control change that will move Platform's live content from
457px to roughly 536px in a 485px budget, and §4.7 will break on the screen that
has the least room to give. The two changes are one change:

1. Translate the control names (broker-side strings through i18n, or move the
   catalogue to the frontend where the translations already exist).
2. Re-measure Platform at 1366×768 in **both** languages with the 4.8 probe, and
   reflow it — CP2 already spent this screen's easy space getting it from 612px
   to 411px, so what is left is a composition decision, not tightening.

Do not treat the +28px as headroom in the meantime. It is not margin the design
earned; it is margin the design is holding only because one surface is
untranslated, and it is denominated in a language the room may not be reading.

**Related, same screen, not the same defect:** switching Live → Simulation
leaves the previous live total ("Total: 13.5 s") rendered on the Gateway
diagram while the rest of the panel has already swapped to placeholder copy.
Logged here rather than in §6 because it is the same "a mode switch does not
fully reset derived state" shape, and whoever picks up the above will be in the
right files for it.

---

## 5. Demo choreography, risks, and prep

The recommended script runs 12 to 15 minutes: open with a question/answer exchange (~90 s, "that's a governed agent in your cloud"), move into the three Access Control tests and the live policy reveal (~3:30, the pivot moment), continue with Agent Governance — two frameworks, one governance model, provenance chain, live RBAC (~3 min), animate the six steps of the Request Journey (~3 min), and close with Platform Control — real audit record, controls catalog, honest cost framing (~3 min), leaving the controls catalog as the natural artifact for the next conversation.

**Prep beforehand — never live during the session:** the Bicep deployment (~30–45 min, dominated by API Management Basicv2 provisioning); `az acr build` for both frameworks (several minutes each); registering both agents (`pydantic-agent`, `strands-agent`); publishing a second version of an agent so the version history isn't empty; optionally adding 2–3 extra API Management subscriptions; **warming the agent** (critical, see risk below); generating ~20 warmup requests to populate telemetry, at least 5 minutes ahead of time due to ingestion latency; recording a full Replay capture as a safety net.

**Risk register:**

| Risk | Severity | Mitigation |
|---|---|---|
| **Foundry hosted-agent cold start** | **High** | The biggest live risk in the entire lab. Warm up immediately before the session and keep warm with a periodic request during setup; Replay mode as a fallback |
| Venue network blocks Azure endpoints | High | Replay mode; mobile tethering as a fallback |
| Application Insights delay leaves the telemetry screen sparse | Medium | Generate warmup traffic ≥5 min ahead of time; the data-age indicator makes sparseness read as honesty, not failure |
| SSE streaming buffered by API Management | Medium | Rehearse; keep the non-streaming fallback |
| Cross-hop correlation unavailable | Medium | Falls back to time-window association, labeled as an approximation |
| `ApiManagementGatewayLlmLog` doesn't populate as expected | Medium | Confirm during rehearsal; if absent, fall back to Application Insights logs and have the presenter state the limitation instead of substituting invented content |
| `az` token expires mid-demo | Medium | Refresh before the session; the host process exposes auth status in the header |
| Subscription key visible on the projector | **High** | Mask to the last four characters everywhere, by construction |
| Unresolved principal names (Graph permission) | Low | Friendly-name mapping for known identities; never fabricate a name |

**Every failure mode recovers by declaring the limitation, never by substituting invented content.** The fallback to Replay is the universal recovery; agent cold start is risk #1.

---

## 6. Technical findings and known lab defects

Logged during analysis and documented rather than silently fixed, because surfacing them builds more credibility with a technical audience than hiding them would:

- **Three real defects in the lab, found during analysis:**
  1. The `hostedAgentResponsesApimPath` output emits `…/hosted-agent-responses/responses`, which isn't a path the API actually exposes — a leftover from an abandoned `agent_reference`-in-request-body design.
  2. The documentation references `src/responses/agents/frameworks/…`; the actual path is `src/frameworks/…`.
  3. `main.bicep` hardcodes the name literals `'-foundry-models'` / `'-foundry-agents'`, so renaming entries in the otherwise-parameterized `aiServicesConfig` breaks the template.

- **Security observations to volunteer, not hide:** the API Management subscription key is injected into the agent container as a plaintext environment variable; the Strands agent exposes a `show_internal_environment_variables` tool that returns every environment variable to whoever calls it; `disableLocalAuth` is not enabled; the ACR admin account is enabled; no rate-limiting policy exists.

- **Foundry hosted-agent cold start** is the biggest live-demo risk in the entire lab (8–17 s measured).

- **`az acr build`** builds on ACR Tasks — no local Docker, and guarantees Linux/amd64.

---

## 7. Note on the implementation status of this correction

This document consolidates six sources that don't all share the same date or the same "approved and implemented" status. The open question they left — whether the hero migration (from Request Journey to Frameworks) and the merge of Controls into Operations actually got implemented — **was verified directly against the real `demo-app/` code during development**, not just against these design documents:

- **Controls merged into Operations, confirmed.** The "Platform" section of the built console (`src/features/operations/OperationsStop.tsx`) is a single surface combining the deployed environment, the controls catalog in its three states (active / available / absent), and the maintenance actions — exactly the merge described in section 4.4 under "Controls / Operations (merged governance)."
- **The "single-page stage with simultaneous regions" composition from section 4.3, however, is not the final architecture.** The console as built is not a single page with always-visible panels — it's navigation across **four top-level sections** (Agents, Gateway, Observability, Platform), each its own full-screen view, selected via tabs (`SectionNav`). Agents is the first section, consistent with the "Frameworks first" reframing in section 3, but as its own section, not as a hero region within a two-column composition. The "stage" metaphor and the lighting states (4.6) survive in spirit — there is a deliberate hierarchy of attention — but the concrete mechanism differs from what's described in 4.3.

Whoever continues the project can treat section 4.3 as the historical record of an intermediate decision, not as the current description of the layout — the current source of truth is the code in `demo-app/src/layout/` and `demo-app/src/features/`.

---

## 8. The lab stopped deploying its own API Management and joined a shared gateway

**Status: done and verified in production on 2026-09-04. The parts deliberately NOT done are listed at the end and are the half of this section most worth reading.**

### Why

An API Management instance is the most expensive thing this lab creates, and it created a fresh one on every deployment. Several teams already share `apim-shared-pdcibwky2f5ms` (Developer tier, `rg-shared-apim-gateway-V2`) for exactly this reason. This lab now registers on it instead.

The cost is a real constraint on how often this lab can be redeployed; the risk is that a shared gateway makes every mistake somebody else's problem too. Everything below is shaped by the second point.

### The rule that made the difference: every name is lab-prefixed

ARM creating a child resource that already exists is an **update in place**, not an error. So an unprefixed name silently takes over another team's resource.

This was not hypothetical. This lab shipped with the notebook's default subscription name, `subscription1`. On the shared gateway `subscription1` already exists, owned by the FinOps lab, scoped to its `finops-framework-platinum` product, and carrying a **$0.05 cost quota wired to a Logic App that suspends the key automatically**. Deploying as-is would have hijacked their subscription *and* put this demo's traffic under a quota it does not control. The reconnaissance that found this is the reason the migration started with a rename rather than with bicep.

Everything is therefore `hosted-agents-*`: the two APIs and their paths, the backend, the product, the subscription, the diagnostic setting.

### Why the split lives here and not in `vendor/`

`vendor/` stays byte-identical to upstream, with patches kept minimal and documented. Teaching the vendored `main.bicep` to use an existing gateway is not a patch of that size, for two independent reasons:

1. **The shared gateway is in another resource group.** A resource-group-scoped deployment cannot create children of a service elsewhere; that needs a module with an explicit foreign `scope`. `main.bicep` has no such concept — it reaches for APIM with `existing` *by name in the current group*.
2. **Upstream has no toggle.** `modules/apim/v3/apim.bicep` creates the service unconditionally. There are conditions for the logger and the diagnostic setting, none for the service.

A patch covering both would be roughly 150 lines through the middle of the file and would conflict on every `sync-vendor.ps1` run. The existing Consumption patch is ten lines at the edge. So the orchestration moved to `labs/…-automation/bicep/`, and **no new patch was added to `vendor/`**.

Two upstream modules turned out to be reusable unmodified, which is why this cost less than feared:

- `foundry.bicep` already grants `Cognitive Services User` to whatever `apimPrincipalId` it is handed. Handing it the shared gateway's principal grants exactly the access needed — written on **our** Foundry accounts, never on the shared gateway.
- `inference-api.bicep` is fully parameterised and **creates no logger**; it references `appinsights-logger` by `resourceId` in its own deployment scope, which under a foreign scope resolves to the shared gateway's existing one.

Only the responses API had to be duplicated, because upstream keeps it inline in `main.bicep` rather than in a module.

### What is deliberately NOT created on the shared gateway

`apim.bicep` creates three service-level resources that **already exist** there: the `appinsights-logger`, the `azuremonitor` diagnostic, and `apimDiagnosticSettings`. That module is not used at all in the migrated path. Recreating `appinsights-logger` would have repointed **every other lab's telemetry** at this lab's Application Insights.

### Telemetry, and what it costs everyone

`/api/journey/:askId` reads `ApiManagementGatewayLogs`, which reaches a workspace only through a **resource-level** diagnostic setting. Azure allows five per resource; three existed, so this lab added a fourth (`hosted-agents-demo-to-loganalytics`), leaving one spare.

Two consequences worth stating plainly:

- It must carry `logAnalyticsDestinationType: 'Dedicated'`. Without it the rows land in the generic `AzureDiagnostics` table and the Observability screen waits forever for data that is arriving under another name. The first version of this file omitted it, and the failure is completely silent — no error anywhere.
- Gateway logs **cannot be filtered per API**. This lab's workspace therefore ingests every connected lab's gateway traffic, and theirs already ingests this one's. That is a property of a shared gateway, not something this repository can fix.

### Teardown is part of this decision, not an afterthought

The resources this lab creates on the shared gateway outlive its resource group. `teardown.ps1` removes them **before** deleting the group, in an order that never leaves a dangling reference, and the diagnostic setting goes first because it is the only one that would be left pointing at a destination that no longer exists — which Microsoft warns can be re-applied to a resource later recreated with the same name.

Removing it is **fatal if it fails**: the teardown stops before touching the resource group. Leaving our own group intact is recoverable; leaving litter in someone else's gateway is not ours to undo.

Two locks guard the deletion, because an allow-list alone is not enough — a wrong config edit would simply be obeyed. A name must carry the lab prefix; the one legitimate exception is the GUID-named subscription API Management generates for a published product, and that one must additionally be confirmed **by Azure** as bound to this lab's product. An early version allowed any listed name and would have deleted `subscription1` if config had said so.

### Accepted residual risks

**The FinOps auto-suspend is one table row away, and it is not ours.** A Logic App in `lab-finops-framework-V24` issues `PATCH` against `.../apim-shared-pdcibwky2f5ms/subscriptions/{name}` where the name comes from an alert payload — not from a fixed list. What keeps this lab out today is an inner join against a custom table, `SUBSCRIPTION_QUOTA_CL`, which currently contains only that lab's four subscriptions. **If anyone adds a row naming `hosted-agents-subscription`, this demo's key is suspended automatically, with no notice to us**, and neither the Logic App nor the table is under this repository's control. Accepted, not mitigated — recorded here so that a demo failing mid-session has a first place to look.

**Migrating an existing lab in place is not the same as deploying a fresh one.** Upstream names its role assignments with `guid(subscription, resourceGroup, config.name, roleDefinitionId)` — no principal id. Pointing the same assignment at a different identity is therefore an update ARM refuses (`RoleAssignmentUpdateNotPermitted`). The old gateway's two assignments had to be deleted first. A deployment into a new resource group never sees this.

**Deployments touching the shared gateway must not be launched from Git Bash.** MSYS rewrites arguments that look like Unix paths, and an ARM resource id starting with `/subscriptions/` became a Windows path before `az` saw it — leaving the shared gateway half-deployed. The environment variable alone is a bad detector (it is inherited by PowerShell too, where nothing is rewritten), so it warns; what actually blocks is a shape check on every resource id immediately before a foreign-scope deployment.

### The saving, realised

`apim-7atp6hx2a4e7u` (BasicV2, ~$197/month) was deleted and purged on 2026-09-04, once the shared path had been verified end to end. Incremental ARM does not delete what a template stops declaring, so this had to be a deliberate act — and it deliberately came *after* verification, not before: an unverified migration plus a deleted fallback is a demo with no way back.

It was checked first rather than assumed idle. Twelve hours of `ApiManagementGatewayLogs` showed exactly three requests to it, all `404` against the root URL `/` with an empty `ApiId` — probes matching no API, not usage. The two things that could still have depended on it were confirmed elsewhere: the App Service's `APIM_GATEWAY_URL` pointed at the shared gateway, and the hosted agents were proven to reach the model through it by a hop-2 row filed under `hosted-agents-inference-api`.

**Note for anyone tempted to reach for `teardown.ps1` here.** It deletes the whole resource group. At the time this APIM was removed the group also held both Foundry accounts, the container registry, the Log Analytics workspace the Observability screen queries, the App Service and its plan — nine resources that had to survive. Removing one resource from a live group is a targeted `az apim delete` followed by `az apim deletedservice purge`; `teardown.ps1` is for disposing of the entire lab.

**Which gateway is used is overridable per run.** `deploy.ps1` and `teardown.ps1` both accept `-SharedApimName` and `-SharedApimResourceGroupName`, defaulting to `config/lab.defaults.psd1`. The shared instance is the one part of this deployment that belongs to nobody in particular, so it is the part most likely to be renamed or replaced — a move to a V3, say — without this repository hearing about it first. A flag makes that day cost a command-line argument rather than an edit to committed configuration, and unset, nothing about a normal run changes.

The two scripts take the same pair on purpose, and they must be given the same values: a teardown reading the config default after a deployment that was pointed elsewhere would look for this lab's resources on the wrong instance, find none, report success, and leave the real ones behind on a gateway it never examined.

### 8.1 Six failures this migration hit, and what each actually was

None of these are visible in the bicep, and **all six fail silently** — no exception, no red text, just a deployment that reports success and a console that is subtly wrong. They are recorded with their exact symptom because the symptom is the only thing the next person will have.

**1 — A deployment to the shared gateway died half-way through**

*Symptom:* `az deployment group create` returned `LinkedInvalidPropertyId`: *"Property id `C:/Program Files/Git/subscriptions/…` at path `properties.workspaceId` is invalid."* Five of six resources were created; the sixth was rejected, leaving another team's gateway partially deployed for about two minutes.

*Root cause:* MSYS (Git Bash) rewrites any argument that looks like a Unix path before a native `.exe` sees it. The Log Analytics workspace id begins with `/subscriptions/`.

*Fix:* re-run from PowerShell, which does not rewrite its own arguments. Permanently, `Assert-ResourceIdShape` (`modules/SharedApim.ps1`) validates every resource id immediately before a foreign-scope deployment and names path mangling as the likely cause. `Assert-NotRunningUnderMsys` only *warns*: `$env:MSYSTEM` is inherited by any process a Git Bash shell starts, including a perfectly safe PowerShell one, so blocking on it stops legitimate runs — which is exactly what the first version did.

**2 — `RoleAssignmentUpdateNotPermitted` on a lab that had deployed fine for weeks**

*Symptom:* `infra.bicep` failed inside `foundryModule`; two `Microsoft.Authorization/roleAssignments` returned `BadRequest` — *"Tenant ID, application ID, principal ID, and scope are not allowed to be updated."*

*Root cause:* upstream's `foundry.bicep` names the assignment `guid(subscription().id, resourceGroup().id, config.name, cognitiveServicesUserRoleDefinitionID)` — **the principal id is not part of the name**. Handing the module the shared gateway's identity therefore asks ARM to change the principal of an existing assignment, which it forbids.

*Fix:* delete the two assignments belonging to the old gateway's identity (`fd73dffa-…`) and redeploy — `8765f675-4a1b-552d-97cc-65f18e0e8bdd` on the models account, `ca75316c-d47a-504b-b1be-ac97f64360e8` on the agents account. **This only bites when migrating an existing lab in place**; a deployment into a fresh resource group never sees it.

**3 — The success path was the one that crashed**

*Symptom:* both bicep deployments succeeded, the before/after comparison printed `+0` on every category, and then the run died: *"No se encuentra la propiedad 'Count' en este objeto."*

*Root cause:* `Compare-SharedApimInventory` returns `@()` when nothing was lost. PowerShell unrolls an empty array returned from a function into `$null`, and under `Set-StrictMode -Version Latest` reading `$null.Count` throws. A *real* loss would have returned a non-empty array and worked fine.

*Fix:* `$lost = @(Compare-SharedApimInventory …)` — the `@()` at the call site is load-bearing, not decoration.

**4 — 404 through the gateway while a manual call to the same URL returned 200**

*Symptom:* `Test-AgentThroughApim` reported 404 for both agents; the direct Foundry call succeeded, and a hand-made `POST` to `/hosted-agents-responses/agents/pydantic-agent/…` returned `200`.

*Root cause:* two sources of truth for one path. The API is registered as `hosted-agents-responses`, but the verification step still read the legacy `$config.HostedAgentResponsesApiPath`, whose value was `hosted-agent-responses`.

*Fix:* the consumers read `$config.SharedApimResources.ResponsesApiPath`, which is what the deployment actually used. The legacy keys were set to the same values and commented as a mirror belonging to the vendored template, so the two cannot hold different truths.

**5 — Observability waited forever for telemetry that was already arriving**

*Symptom:* `/api/journey/:askId` never left `available: false`. The workspace *was* receiving gateway logs — 54 rows — but `ApiManagementGatewayLogs` stayed empty. No error anywhere; the screen simply looked like ingestion was slow.

*Root cause:* the diagnostic setting defaulted to `logAnalyticsDestinationType: 'AzureDiagnostics'`, which files rows in the generic `AzureDiagnostics` table. `ApiManagementGatewayLogs` is a *resource-specific* table and needs `'Dedicated'`. Found by diffing against upstream's own `apim.bicep`, which sets it.

*Fix:* add `logAnalyticsDestinationType: 'Dedicated'`. Expect a delay before it takes effect — measured at about 16 minutes here, and Microsoft allows up to 90.

**6 — The API names were literals in nine places in application code**

*Symptom:* after a fully green deployment, production `/api/ask` answered **404**. Fixing that alone would not have been enough: `/api/journey` and `/api/observability` would still never have matched a hop, silently.

*Root cause:* renaming the APIs for the shared gateway changed values that were hard-coded across the app, not only in bicep — `broker/src/config.ts` (the path), the `ApiId` filters in `journey.ts` (×2) and `observability.ts` (×2), four spots in `maintenance.ts`, the map in `policy.ts`, and three strings the console shows **to the audience**. `ApiManagementGatewayLogs.ApiId` carries the API name, so a stale literal there produces no error — just a hop that never matches.

*Fix:* single-sourced. `HOSTED_AGENT_API_PATH`, `HOSTED_AGENT_API_NAME` and `INFERENCE_API_NAME` come from `config/lab.defaults.psd1` and are set by `deploy.ps1` as app settings. `policy.ts` keeps **stable keys** facing the console and maps them to deployed names server-side, so the frontend's types never depend on what the gateway happens to call things.

### 8.2 A standalone-APIM mode was designed, costed, and deliberately not built

**Status: evaluated and deferred, not forgotten. The design and the verification plan below are finished; what is missing is a reason to run them.**

`deploy.ps1` always connects to the shared gateway. There is no flag to deploy an API Management instance of the lab's own — the behaviour it had before this migration — and that is a decision rather than an omission.

**The obvious objection first.** A standalone mode is a fallback: if the shared gateway is deleted, misconfigured by another team, or simply unavailable, this lab cannot deploy at all. That is a real dependency and it is worth naming.

**Why it was still deferred.** A mode nobody runs decays without anyone noticing, and this section is being written directly beneath the proof. The automation's README carried a section titled *"APIM tier — `Basicv2` by default, `Consumption` for scratch environments"* describing how to choose a tier — a choice the script had already lost when it stopped deploying an APIM at all. It documented behaviour that no longer existed, and nothing caught it, because documentation has no test. A `-StandaloneApim` switch would be the same thing in executable form: a second code path taken by no one, drifting out of step with the path that is exercised daily, and discovered to be broken at exactly the moment it is needed — which is the moment the shared gateway is already down.

An untested fallback is not a fallback. It is a second failure waiting to coincide with the first.

**What would change the answer.** A concrete need, not a hypothetical one:

- the shared gateway stops being available, or the arrangement with the other teams ends;
- someone needs a genuinely isolated environment — a security review, a customer-specific deployment, a test that must not appear in another team's Log Analytics workspace;
- the cross-lab telemetry mixing described above becomes a problem in its own right.

**The plan, so the next person does not re-derive it.** Roughly 60-80 lines across four files — `deploy.ps1` (a switch plus a four-point branch: which template, whether to register on the shared gateway, which output composer, and where the three API-name app settings come from), `config/lab.defaults.psd1` (`ApimSku`), and `modules/Infra.ps1` (revive `New-BicepParametersFile`, currently dead code). `teardown.ps1` most likely needs nothing: its shared-gateway cleanup already treats a 404 as success, so in standalone mode it reports "not present" nine times and moves on.

Two constraints that are not negotiable if it is built:

1. **The names stay `hosted-agents-*` in both modes.** A standalone instance has no collision risk, so different names would be *allowed* — and would immediately reintroduce failure #6 above, where the same value lived in two places and one of them went stale. One set of names means the three app settings are identical in both modes.
2. **`Developer`, never `Consumption`.** Developer is dedicated, always-on capacity, so it has no cold start, and it is roughly a quarter the price of `Basicv2`. Consumption is serverless and was measured at **54 seconds** on the first request after 35 minutes idle. Developer's trade-offs — no SLA, a single unit, no scaling — are the right shape for a demo lab, and are already what the shared gateway is.

**And it must be verified in a scratch resource group, not the live one.** Deploying a standalone instance into `lab-hosted-agents-demo` would create an APIM there, repoint the App Service at it, and undo this migration. Budget ~1.5-2 hours, almost all of it waiting on APIM provisioning and then on its deletion and purge.

## See also

- [`../01-general/ARCHITECTURE.md`](../01-general/ARCHITECTURE.md) — the Azure architecture these decisions visualize.
- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — the current implementation status.
- [`HISTORY.md`](HISTORY.md) — the full chronological development history.
