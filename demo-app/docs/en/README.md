# Demo documentation

**[🇪🇸 Leer esto en español →](../es/README.md)**

> **Important notice:** this demo **complements** the official Microsoft lab "AI Foundry Hosted Agents with Custom Frameworks" — **it does not replace Azure AI Foundry** or any official Microsoft tool. See [`01-general/PURPOSE.md`](01-general/PURPOSE.md) for the full detail.

Index of all the documentation that belongs to this demo application (`demo-app`). Everything here describes the **demo** — not the official Microsoft lab, whose documentation lives in the external [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway) repository and isn't touched from here.

If you're new to the project, here's the suggested reading order:

1. [`01-general/PURPOSE.md`](01-general/PURPOSE.md) — why this application exists.
2. [`01-general/ARCHITECTURE.md`](01-general/ARCHITECTURE.md) — what Azure architecture it visualizes.
3. [`02-presentation/PRESENTATION_GUIDE.md`](02-presentation/PRESENTATION_GUIDE.md) — how it's presented, step by step.
4. Everything else, as needed — see the full map below.

## 01 — General

Project fundamentals: what it is, how it's built, and how the built-in assistant behaves.

| Document | Contents |
|---|---|
| [`PURPOSE.md`](01-general/PURPOSE.md) | Goal, scope, audience, and philosophy of the demo. Why it exists and what it isn't. |
| [`ARCHITECTURE.md`](01-general/ARCHITECTURE.md) | Full technical architecture of the Azure deployment the demo visualizes: API Management, Microsoft Foundry, managed identity, observability. |
| [`DEPLOYMENT_AND_COSTS.md`](01-general/DEPLOYMENT_AND_COSTS.md) | What has to run for the demo to work, what it costs to operate, how the copilot behaves as infrastructure, hosting options, and when RAG would become the right call. Facts, estimates, and recommendations are labeled separately. |
| [`COPILOT_CONTEXT.md`](01-general/COPILOT_CONTEXT.md) | Instructions and boundaries for the built-in assistant — its tone, its honesty boundary, and the rule that it never presents itself as a replacement for Azure AI Foundry. |

## 02 — Presentation

Everything needed to present the demo to a customer.

| Document | Contents |
|---|---|
| [`PRESENTATION_GUIDE.md`](02-presentation/PRESENTATION_GUIDE.md) | Full word-for-word script: introduction, the four sections, closing. |
| [`PRESENTATION_FLOW.md`](02-presentation/PRESENTATION_FLOW.md) | One-page quick view: timing, on-screen actions, and each segment's key message. |
| [`FAQ.md`](02-presentation/FAQ.md) | Suggested answers to typical tough customer questions. |

## 03 — Development

Technical documentation for whoever maintains or extends the demo — design decisions, Azure verification, and project status.

| Document | Contents |
|---|---|
| [`DESIGN_DECISIONS.md`](03-development/DESIGN_DECISIONS.md) | Design philosophy, product positioning evolution, experience architecture, and visual system. |
| [`AZURE_INTEGRATION_REPORT.md`](03-development/AZURE_INTEGRATION_REPORT.md) | What was verified against real Azure during development, and how. |
| [`PROJECT_STATUS.md`](03-development/PROJECT_STATUS.md) | Live snapshot of current status — what's closed, what remains as documented technical debt. |
| [`HISTORY.md`](03-development/HISTORY.md) | Chronological development history, by milestone. |

## 04 — References

| Document | Contents |
|---|---|
| [`LINKS.md`](04-references/LINKS.md) | Links to the official lab, the repository, and external Microsoft documentation. |

## Conventions

- All documentation in this folder is in **English**. Azure service proper names (API Management, Microsoft Foundry, Log Analytics…) are kept as Azure itself uses them.
- Documents in `01-general/` and `02-presentation/` are written for a pre-sales audience (architects, consultants, customers) — no code jargon.
- Documents in `03-development/` are written for whoever maintains the project — they do include technical detail.
- The official Microsoft lab (its README, notebook, Bicep, and `src/frameworks/`) lives in [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/ai-foundry-hosted-agents-custom-framework) — an external, independent source that this repository neither contains nor manages.
