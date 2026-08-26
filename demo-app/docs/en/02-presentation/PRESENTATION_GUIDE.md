# Presentation guide

Complete script for presenting the demo to a customer. Before reading this, if you haven't already, read [`PURPOSE.md`](../01-general/PURPOSE.md) — this guide assumes you already know the application is a pre-sales tool, not a product or a replacement for Azure AI Foundry.

Suggested duration: **12–15 minutes** of walkthrough + questions. This is a script, not a rigid one — the real power of this demo is that every piece of data is real, so you can go off-script to answer whatever the room asks and come back without losing credibility. For a quick view of timing and key messages without the full text, see [`PRESENTATION_FLOW.md`](PRESENTATION_FLOW.md).

---

## Before you start (presenter checklist)

- [ ] **Azure Live** mode active (not Simulation) — it's the default mode, confirm it in the top corner of the header.
- [ ] Open the settings menu (gear icon) → Presenter Tools → Maintenance, and run at least:
  - **Check broker** (`ping`) — confirms the local backend is responding.
  - **Warm up agent** (`warm-agent`) — a container's first cold start can take 10–17s; doing this ahead of time avoids that awkward silence live.
- [ ] Confirm both agents (`pydantic-agent`, `strands-agent`) show as *Running* in the Agents section.
- [ ] Have a backup question ready for the copilot in case you want to demo it (see the "The copilot" section below).
- [ ] If you're presenting without a reliable internet connection, keep Simulation as a safety net — but state clearly that it's a rehearsal, never present it as real data.

**Navigation:** the four sections (Agents, Gateway, Observability, Platform) are tabs at the top — click to move between them, in whatever order you prefer. Useful keyboard shortcuts during the presentation:
- `C` — open/close the built-in copilot.
- `S` — run the three-credential test (useful in the Gateway section, see below).
- `L` — toggle between Azure Live and Simulation.
- `Esc` — close the copilot, or return to the home screen.

---

## 0. Introduction (0:00 – 1:30)

**On screen:** the home screen, before clicking "Start executive demo."

**Script:**

> "What you're about to see isn't a mockup or a diagram. It's a console connected live to a real Azure subscription, where we have two AI agents deployed, built with two different frameworks — Pydantic AI and Strands — running as the same type of governed asset inside Microsoft Foundry, with Azure API Management as the control point.
>
> Everything you're going to see — the agents' responses, the security policies, the telemetry — is real. There's no sample data hiding behind it. If something isn't available, I'll tell you that explicitly instead of making up a number."

Click **"Start executive demo."**

**Why it matters:** it sets the ground rules from the first second — everything that follows earns credibility because it was said, out loud, that nothing is fabricated.

---

## 1. Agents (1:30 – 4:00)

**Customer question this section answers:** *"What do I have deployed, and what state is it in?"*

**On screen:** the list of registered agents, with `pydantic-agent` and `strands-agent`.

**Script:**

> "Here's the live registry from Microsoft Foundry — not a hardcoded list in this application's code, but what Foundry actually has registered right now. Two agents, each built with a different framework."

Select `pydantic-agent`, show the **Overview** tab:

> "This is the object Foundry knows about the agent: the container image, the version — immutable, publishing again creates a new version, never overwrites — CPU, memory, and the keys of the environment variables it uses. The values are never shown here, only the keys, because one of them is the gateway access credential."

Switch to the **Versions** tab briefly:

> "Every publish is recorded as its own version. This is what lets you say, with certainty, exactly which build answered a given request — something an audit team is going to ask about."

Switch to the **Run** tab and, if time allows, invoke the agent live with a simple question:

> "I can invoke the agent directly from here — this calls the same endpoint any real client would use, through the same governed path we're about to see in the next section."

**Key message to close the section:**

> "The point isn't that we have two agents. The point is that any framework a customer's team is already using — not just these two — can become this same type of governed asset, without rewriting it."

*(Optional, if the room asks about lifecycle management: the console also lets you create and delete test agents live from the "+" and trash icons next to the listing — useful for showing that the registry responds immediately, but not necessary for the standard script.)*

---

## 2. Gateway (4:00 – 8:00) — the longest section, the deal-closer

**Customer question this section answers:** *"How do clients reach the agent, and who controls that?"*

In most conversations, this is the section that decides whether the customer stays interested. Take your time.

**On screen:** the Gateway section, showing how traffic is routed to the agent.

**Script:**

> "Here's the core idea behind this whole architecture: Azure API Management appears **twice** in the path of a single request. The first time, at the front — the client never talks directly to the agent, it talks to APIM. The second time, when the agent itself needs to call the model — that call also goes through APIM before it reaches `gpt-5-mini`.
>
> Most architectures only govern the front door and leave the traffic the agent generates toward the model uncontrolled. Here, both directions cross the same control point the platform team already owns."

Show the accepted credentials / the route diagram:

> "The client only needs an API Management subscription key — not an Azure AD credential, not a Foundry key, not a model key. APIM exchanges that key for a managed identity token, generated per request and never stored."

**Live demo — the three-credential test** (access test button, or shortcut `S`):

> "I'm going to try three ways of reaching the agent right now, live."

Run the test and narrate the result as it appears:

> "With the subscription key: 200, it works. Without the key: 401, rejected by APIM before the request ever reaches Foundry. Going straight to the Foundry endpoint, bypassing the gateway: also 401, because there's no Azure AD token. Those two rejections are the expected outcome, not an error — they're proof the perimeter is actually doing its job."

**Reveal the XML policy:**

> "This is the policy running on the gateway right now — not a sample file, but what Azure Resource Manager is returning at this very moment. This is where the managed identity token gets acquired and the authorization header gets overwritten before the request is forwarded."

**Key message to close the section:**

> "In this implementation, all of this adds single-digit millisecond latency per hop — compared to the several seconds the model generation itself takes. Putting a governed control point in the path costs no noticeable performance."

---

## 3. Observability (8:00 – 10:30)

**Customer question this section answers:** *"What evidence does the platform generate?"*

**On screen:** the audit log of the latest request, with the detail expanded.

**Script:**

> "None of this data was added by writing extra code inside the agent. The Bicep deployment already creates the Log Analytics workspace and Application Insights, and connects API Management to both — so the gateway itself writes the full prompt, the full response, the token count, and the duration of every hop."

Expand a request's detail to show the span timeline:

> "This is a real distributed trace, not a reconstruction from timestamps. You can follow a single request through the gateway, through the Foundry runtime, and into the agent's container — including the exact moment the managed identity token is acquired, which shows up here as its own span."

**Key message to close the section:**

> "For a compliance or risk function, this is what actually matters: not a promise that everything is being logged, but the evidence that it already is — with two independent sources, the gateway and the container's own instrumentation, that agree with each other."

---

## 4. Platform (10:30 – 12:30)

**Customer question this section answers:** *"What's deployed, and what does the operations team manage?"*

**On screen:** the Platform section, with the environment and the controls catalog.

**Script:**

> "Here's the real environment: region, resource group, and the resource count that Azure Resource Manager returns right now — not a manually documented figure."

Show the controls catalog, highlighting the three categories:

> "This catalog has three states, and that distinction is deliberate. **Active** are controls evidenced by the request we just made — each one cites the exact observation that proves it. **Available** are controls that this same control point supports but aren't turned on in this environment — rate limiting, semantic caching, private networking, Entra-only authentication, secrets management with Key Vault. Turning them on is a configuration change on a gateway the company already owns, not a rebuild.
>
> And whatever isn't on this list at all, I'll tell you directly instead of letting you guess."

If time allows, run one of the maintenance actions live (for example, **Refresh Azure status**):

> "These are the same checks an engineer would run before a session — here they're a click away, against the real infrastructure."

---

## 5. Wrap-up (12:30 – 14:00)

**Script:**

> "To recap what we just saw, in terms of the five questions any enterprise architect asks: Does it work? Yes, you just watched it respond live. What's happening right now? Every hop, measured. Is it secure? Three access attempts, two rejected exactly as expected, and the policy that proves it, read live. Can I control my AI agents? A versioned, immutable registry, and a controls catalog that doesn't hide what's missing. Why does it matter? Because every one of those answers comes backed by Azure evidence, not a marketing claim.
>
> Everything you saw runs on top of the official Microsoft lab 'AI Foundry Hosted Agents with Custom Frameworks' — it's published, it's reproducible, and the natural next step is for your team to deploy it in their own subscription and review it line by line."

**Suggested call to action:** offer a technical notebook walkthrough with their engineering team, or an architecture session focused on their specific use case.

---

## The copilot

At any point during the presentation you can open the built-in assistant (`C`, or the chat icon in the header) and ask it a live question — the answer travels through the same real path being explained (APIM → hosted agent → model), so using it is, in itself, one more demonstration.

It's instructed to respond like an experienced Azure solutions architect, in the language of the question, and to never present this application as a replacement for Azure AI Foundry (see [`COPILOT_CONTEXT.md`](../01-general/COPILOT_CONTEXT.md) for the full detail). Use it with confidence for questions the script didn't cover — it's more credible for the presenter to use it live than to avoid it.

---

## See also

- [`PURPOSE.md`](../01-general/PURPOSE.md) — the full goal, scope, and philosophy.
- [`COPILOT_CONTEXT.md`](../01-general/COPILOT_CONTEXT.md) — the exact instructions the built-in assistant follows.
- [`FAQ.md`](FAQ.md) — suggested answers to typical tough customer questions.
- [`PRESENTATION_FLOW.md`](PRESENTATION_FLOW.md) — a quick view of timing and key messages, without the full script text.
- [`README.md`](https://github.com/Azure-Samples/AI-Gateway/blob/main/labs/ai-foundry-hosted-agents-custom-framework/README.md) (official lab, external) — the official Microsoft lab description.
