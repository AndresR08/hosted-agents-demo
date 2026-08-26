# Acknowledgements

This project would not exist without the work it visualizes. It is a companion, not a fork — full credit for the underlying architecture, infrastructure, and sample agents belongs to the original authors.

## The official Microsoft lab

**["AI Foundry Hosted Agents with Custom Frameworks"](https://github.com/Azure-Samples/AI-Gateway/tree/main/labs/ai-foundry-hosted-agents-custom-framework)**, part of the [`Azure-Samples/AI-Gateway`](https://github.com/Azure-Samples/AI-Gateway) repository, published by **Microsoft Corporation** under the [MIT License](https://github.com/Azure-Samples/AI-Gateway/blob/main/LICENSE.md).

That lab designed and owns:

- The Bicep infrastructure-as-code templates (`main.bicep`) that deploy Azure API Management, the two Microsoft Foundry accounts, Azure Container Registry, Log Analytics, and Application Insights.
- The APIM policy documents (`policy.xml`, `hosted-agent-policy.xml`) that implement the managed-identity credential exchange this project's Gateway section demonstrates.
- The end-to-end deployment notebook (`ai-foundry-hosted-agents-custom-framework.ipynb`) and the cleanup notebook.
- The two sample agent implementations (`src/frameworks/pydantic/`, `src/frameworks/strands/`) that this project's Agents section reads and invokes.
- Credited author: **georgeollis** (per the lab's own README front matter).

This project reads that deployment's live Azure resources through a broker. It does not modify or replace any of the files above.

## Redistributed under the MIT License

`vendor/ai-gateway/` contains a copy of the lab and the shared Bicep modules its `main.bicep` depends on, taken from `Azure-Samples/AI-Gateway` and **redistributed under that repository's MIT License**, which permits redistribution provided the copyright and permission notices are preserved. They are, unmodified, in [`vendor/ai-gateway/LICENSE.md`](vendor/ai-gateway/LICENSE.md).

The copy exists so this repository stands alone: its deployment automation runs from a fresh clone, with no second checkout required. The vendored files are **byte-identical to upstream** — nothing is patched, and everything in `vendor/` remains the work and the property of Microsoft Corporation and the lab's contributors.

[`vendor/ai-gateway/NOTICE.md`](vendor/ai-gateway/NOTICE.md) records the exact upstream commit and date each file came from, and what is included. `labs/…-automation/scripts/sync-vendor.ps1` refreshes it; a scheduled workflow opens a pull request when upstream changes, and a person reviews every one.

## Reused asset

`assets/ai-foundry-hosted-agents.gif` — the lab's own architecture diagram, copied locally from the official repository and reused under the terms of its MIT License, with attribution as required. Source: [`Azure-Samples/AI-Gateway/images/ai-foundry-hosted-agents.gif`](https://github.com/Azure-Samples/AI-Gateway/blob/main/images/ai-foundry-hosted-agents.gif).

## Frameworks demonstrated

- **[Pydantic AI](https://ai.pydantic.dev/)** — one of the two agent frameworks the lab hosts and this console visualizes.
- **[Strands Agents](https://strandsagents.com/)** — the second of the two agent frameworks.

Neither framework's own source or documentation is included in this repository; this project only reads what the deployed agents report about themselves through Microsoft Foundry.

## Technology this project is built with

- [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/) — the frontend console.
- [Fluent UI React Components](https://react.fluentui.dev/) — Microsoft's own design system, used for visual consistency with the Azure ecosystem it visualizes.
- [Tailwind CSS](https://tailwindcss.com/) — utility styling.
- [Zustand](https://zustand-demo.pmnd.rs/) — application state.
- [Express](https://expressjs.com/) — the local broker that authenticates against Azure on the console's behalf.
- [Azure Identity SDK for JavaScript](https://learn.microsoft.com/javascript/api/overview/azure/identity-readme) (`DefaultAzureCredential`) — the broker's authentication path.

## A note on independence

This project is not affiliated with, endorsed by, or produced in partnership with Microsoft Corporation. "Microsoft", "Azure", "Microsoft Foundry", and related marks are trademarks of Microsoft Corporation, used here only to accurately describe the platform this project visualizes.
