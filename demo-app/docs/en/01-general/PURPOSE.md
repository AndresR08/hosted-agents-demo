# Purpose of this demo

## In one sentence

This application is a **presales tool**: a visual, interactive console that helps explain, in a meeting with a customer, the official Microsoft lab **"AI Foundry Hosted Agents with Custom Frameworks"** (repository [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway)) — without anyone having to read a Jupyter notebook on screen.

It is not a product. It is not a replacement for Azure AI Foundry. It is a narrator.

## What problem it solves

The official lab is excellent for what it was built for: an engineer, step by step, in a notebook, deploying real infrastructure with Bicep, building a container image, registering it as a Hosted Agent, and testing it against Azure. It is the technical source of truth and the reproduction path.

But a notebook is not a good vehicle for a 15-minute conversation with a CIO, a CISO, or a lead architect at a regulated enterprise. Nobody is going to read Python cells in a boardroom, and explaining "dual gateway architecture" with a static diagram doesn't let anyone see that the system actually works, is secure, and is governable.

This demo translates that same lab — deployed, real, with no fake data — into a clickable narrative that a solutions architect or a presales consultant can present without writing a single line of live code.

## What it is

- A **presentation layer** over the real resources the lab deploys: Azure API Management, two Microsoft Foundry accounts, a `gpt-5-mini` deployment, Azure Container Registry, Log Analytics, and Application Insights.
- An application that **reads** those resources live — it never replaces them, never manages them, never invents what it shows.
- An instrument designed for **a single presenter**, with an audience that watches and asks questions, not a day-to-day operations dashboard.
- A built-in copilot that answers architecture questions on the spot, speaking from inside the very solution being shown (see [`COPILOT_CONTEXT.md`](COPILOT_CONTEXT.md)).

## What it is NOT

- **It is not Azure AI Foundry.** It does not replace the Foundry portal or the Azure Portal. Registering agents, changing policies, day-to-day operations — all of that still happens in those tools, not here.
- **It is not a Microsoft product or a supported artifact.** It is a presales asset built on top of an open-source lab.
- **It is not an operations console.** It does not substitute for the Azure Portal, Azure Monitor, or any real management tool.
- **It is not a generic chatbot.** The copilot exists as evidence that the platform works — every answer it gives travels the same real path (APIM → hosted agent → model) that the rest of the demo is explaining.
- **It is not a benchmark.** The two agent frameworks (Pydantic AI and Strands) are shown side by side for engineering reasons, never as a "which one is better" comparison.

## Audience

**Who presents it:** Microsoft sales engineers, cloud solution architects (CSAs), partner consultants.

**Who watches it:** enterprise architects, CIOs/CISOs, risk and compliance teams — typically in regulated industries (banking, insurance, healthcare, retail) where "is this secure and auditable?" is the question that decides whether the conversation continues.

## Scope — the four sections

The console has four sections, each answering the question an enterprise customer actually asks at this stage of the conversation:

| Section | Customer question | What it demonstrates |
|---|---|---|
| **Agents** | "What do I have deployed, and what state is it in?" | Two different frameworks (Pydantic AI, Strands) running as the same kind of governed asset: a Foundry Hosted Agent. Live registry, immutable versions, real invocation. |
| **Gateway** | "How do clients reach the agent, and who controls that?" | Azure API Management as a single control point, appearing twice in the same request path (toward the agent and from the agent toward the model). Authentication via subscription key, not Azure credentials. |
| **Observability** | "What evidence does the platform generate?" | Real end-to-end traceability: APIM logs, Application Insights, Log Analytics — not a log simulation. |
| **Platform** | "What's deployed, and what does the operations team manage?" | The real environment (region, resource group, resource count) and a catalog of controls in three states: active (evidenced), available (configurable, not turned on), and absent (out of scope for this lab). |

## Philosophy — non-negotiable rules

1. **Truth over polish.** Every piece of data shown states its origin. Nothing is invented. If Azure doesn't return it, the application says "not available" — it never fills the gap with a plausible-looking number.
2. **Live where it matters, honest where it isn't.** The default mode (*Azure Live*) calls real infrastructure on every panel. *Simulation* mode exists only as a rehearsal safety net — every panel visibly re-labels itself when the mode changes, so simulated data is never presented as if it were real.
3. **What isn't active is explained, not hidden.** A control that's available but not turned on (rate limiting, semantic caching, private networking, etc.) is presented as a configuration decision at a control point the enterprise already owns — never as a gap in the architecture.
4. **Nothing that takes more than ~15 seconds runs live without a safety net.** The design assumes this is presented in front of a customer, not in a fault-tolerant dev environment.
5. **The demo never presents itself as the product.** The product is Microsoft Foundry governed by Azure API Management. This application is the way to tell that story well.

## Relationship to the official lab

This application does not replace the `ai-foundry-hosted-agents-custom-framework.ipynb` notebook — it depends on someone having already run it. The lab remains the sole authoritative source for *how to deploy* this: infrastructure via Bicep, image build in ACR, Hosted Agent registration via the Foundry data-plane SDK. This console simply reads, live, what that deployment produced, and tells it as a 10-15 minute story instead of a 30-45 minute notebook run.

If a customer asks "I want to see this running in my own subscription," the right answer is to point to the lab — this demo is the conversation that opens that door, not the mechanism that builds it.

## When to use it / when not to

**Use it for:**
- Early technical conversations with a customer about AI agent governance.
- Architecture reviews with a security or compliance team.
- Executive briefings where time is short and live code on screen would kill the moment.

**Don't use it for:**
- Operating or administering a real environment — it is not an operational console.
- As a support or troubleshooting tool.
- As a system of record for anything — the data it shows is ephemeral by design (see [`PROJECT_STATUS.md`](../03-development/PROJECT_STATUS.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) for the technical detail of what persists and what doesn't).

## See also

- [`PRESENTATION_GUIDE.md`](../02-presentation/PRESENTATION_GUIDE.md) — the full script, section by section, for presenting it.
- [`COPILOT_CONTEXT.md`](COPILOT_CONTEXT.md) — what instructions the built-in assistant follows and its honesty boundaries.
- [`README.md`](https://github.com/Azure-Samples/AI-Gateway/blob/main/labs/ai-foundry-hosted-agents-custom-framework/README.md) (official lab, external) — the official description of the Microsoft lab this demo visualizes.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the full technical detail of what gets deployed and how, for anyone who needs to go beyond the commercial pitch.
