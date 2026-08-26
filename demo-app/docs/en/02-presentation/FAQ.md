# Frequently asked questions and how to answer them

Suggested answers to the tough questions a customer typically asks during or after the presentation. Complements [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md) — read that first for the full context of the script.

**"Is this a Microsoft product? Can I buy it / is it supported?"**
No. It's a pre-sales tool built on top of an official Microsoft open-source lab. What is supported and real is the underlying architecture: Foundry, API Management, Log Analytics.

**"Does this replace the Azure AI Foundry portal?"**
Not at all. Everything you see here is read live from the same resources you'd see in the Foundry portal or the Azure Portal. Registering agents, changing policies, day-to-day operations — that still happens there, not here. This console is the narration, not the working tool.

**"Why two frameworks? Which one is better?"**
It's not a performance comparison. It's proof that the platform is framework-agnostic: a customer's team can keep using the tools they already know and still inherit the same identity, the same gateway, and the same auditing. Pydantic AI and Strands exist for different engineering reasons — output typing and validation in one case, context management and agent loop control in the other.

**"What does this cost in production?"**
We don't show cost figures in this demo because we aren't capturing them reliably in this lab — giving you a made-up number would be exactly the kind of fabricated data this application refuses to show. We can take that conversation to a costing exercise with your FinOps team. *(Presenter note: for the cost model behind this — what's fixed, what's variable, and how to produce a real figure — see [`DEPLOYMENT_AND_COSTS.md`](../01-general/DEPLOYMENT_AND_COSTS.md).)*

**"Is this secure enough for a bank / insurer / hospital?"**
What you just saw — revocable key-based authentication, managed identity on both hops, full prompt-and-response auditing, content filtering on the model — is real and active today in this lab. What's not turned on (rate limiting, private networking, Entra-only authentication, Key Vault) are known configuration changes, not architectural gaps, and we show them to you explicitly in the Platform section instead of hiding them.

**"What happens if the internet connection drops during the presentation?"**
There's a Simulation mode as a rehearsal safety net — every panel is visibly re-labeled when you switch to it, so it's never presented as real data. It's better to pause and explain that than to pretend it's still live.

**"Can I customize this for my industry / my use case?"**
The architecture, yes — any agent framework can become a Hosted Agent following the same pattern. This specific console is an internal pre-sales tool; what gets customized is the conversation and the underlying lab, not this application.

**"How do I deploy this myself?"**
With the official lab's `ai-foundry-hosted-agents-custom-framework.ipynb` notebook — it runs end to end, with a variable to choose the framework (`strands` or `pydantic`), and requires no local Docker because the image is built in Azure Container Registry.

## See also

- [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md) — the full presentation script.
- [`PURPOSE.md`](../01-general/PURPOSE.md) — the full goal, scope, and philosophy.
