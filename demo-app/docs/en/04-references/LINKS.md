# Reference links

## The official lab

- [`README.md`](https://github.com/Azure-Samples/AI-Gateway/blob/main/labs/ai-foundry-hosted-agents-custom-framework/README.md) (official lab, external) — the official Microsoft description: what it deploys, what it contains, how to run it.
- `ai-foundry-hosted-agents-custom-framework.ipynb` (official lab, external) — the end-to-end notebook: deploys the infrastructure with Bicep, builds the image for the chosen framework, registers it as a Hosted Agent, and tests it directly and through API Management.
- [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway) repository on GitHub — the repository containing this lab along with other related API Management + AI labs.

## Microsoft documentation (external reference)

- [Azure API Management documentation](https://learn.microsoft.com/azure/api-management/) — the gateway that governs both hops of every request in this lab.
- [Azure AI Foundry documentation](https://learn.microsoft.com/azure/ai-foundry/) — the platform that hosts the agents.
- [Azure Monitor / Log Analytics documentation](https://learn.microsoft.com/azure/azure-monitor/) — the destination for the telemetry the demo's Observability section reads live.

## Map of this demo's documentation

See the full index in [`../README.md`](../README.md). Quick summary:

| Document | What it's for |
|---|---|
| [`../01-general/PURPOSE.md`](../01-general/PURPOSE.md) | Why this application exists, what it is and isn't |
| [`../01-general/ARCHITECTURE.md`](../01-general/ARCHITECTURE.md) | Technical architecture of the deployment the demo visualizes |
| [`../01-general/DEPLOYMENT_AND_COSTS.md`](../01-general/DEPLOYMENT_AND_COSTS.md) | What has to run, what it costs to operate, hosting options, and future scalability |
| [`../01-general/COPILOT_CONTEXT.md`](../01-general/COPILOT_CONTEXT.md) | Instructions and boundaries for the built-in assistant |
| [`../02-presentation/PRESENTATION_GUIDE.md`](../02-presentation/PRESENTATION_GUIDE.md) | Full script for presenting the demo |
| [`../02-presentation/PRESENTATION_FLOW.md`](../02-presentation/PRESENTATION_FLOW.md) | Quick view of timing and key messages |
| [`../02-presentation/FAQ.md`](../02-presentation/FAQ.md) | Suggested answers to tough customer questions |
| [`../03-development/DESIGN_DECISIONS.md`](../03-development/DESIGN_DECISIONS.md) | Philosophy, positioning, and (technical) design decisions |
| [`../03-development/AZURE_INTEGRATION_REPORT.md`](../03-development/AZURE_INTEGRATION_REPORT.md) | What was verified against real Azure and how |
| [`../03-development/PROJECT_STATUS.md`](../03-development/PROJECT_STATUS.md) | Current project status (live snapshot) |
| [`../03-development/HISTORY.md`](../03-development/HISTORY.md) | Chronological development history |
