# Presentation guide

Complete script for presenting the demo to a customer. Before reading this, if you haven't already, read [`PURPOSE.md`](../01-general/PURPOSE.md) — this guide assumes you already know the application is a pre-sales tool, not a product or a replacement for Azure AI Foundry.

Suggested duration: **12–15 minutes** of walkthrough + questions. This is a script, not a rigid one — the real power of this demo is that every piece of data is real, so you can go off-script to answer whatever the room asks and come back without losing credibility. For a quick view of timing and key messages without the full text, see [`PRESENTATION_FLOW.md`](PRESENTATION_FLOW.md).

---

## Before you start (presenter checklist)

- [ ] **Azure Live** mode active (not Simulation) — it's the default mode, confirm it at the bottom of the left rail, where the dot and the region sit permanently.
- [ ] Open the settings drawer (gear icon, bottom of the rail) → **Maintenance**, the first section, and run at least:
  - **Check broker** (`ping`) — confirms the local backend is responding.
  - **Warm up agent** (`warm-agent`) — a container's first cold start can take 10–17s; doing this ahead of time avoids that awkward silence live.
- [ ] Confirm both agents (`pydantic-agent`, `strands-agent`) show as *Running* in the Agents section.
- [ ] Have a backup question ready for the copilot in case you want to demo it (see the "The copilot" section below).
- [ ] If you're presenting without a reliable internet connection, keep Simulation as a safety net — but state clearly that it's a rehearsal, never present it as real data.

**Navigation:** the four sections live in the dark rail down the left side — click to move between them, in whatever order you prefer. Two of them carry sub-tabs in their own header row, which is where most of the console actually is: **nine destinations, not four.** Learn the map below before you present; it is the difference between showing the argument and skipping it.

The rail folds to a 64px icon strip when you open the copilot at 1366×768, and comes back when you close it. Nothing moves — the icons stay in the same order and the same place.

Useful keyboard shortcuts during the presentation:
- `C` — open/close the built-in copilot.
- `S` — run the three-credential test **and jump to the tab that shows the result**. This is the fastest route to the 401; see Beat 3.
- `L` — toggle between Azure Live and Simulation.
- `Esc` — close the copilot, or return to the home screen.

### The map — nine destinations

| # | Section → tab | The question it answers | Do not skip |
|---|---|---|---|
| 1 | **Agents** → Summary | What is deployed, and in what state? | |
| 2 | Agents → Versions | What has been released, and when? | |
| 3 | Agents → Run | Ask this specific agent directly | |
| 4 | **Gateway** → Live | How do clients reach the agent? | The two APIM hops |
| 5 | **Gateway → Credentials** | Which credentials are accepted? | **The 401. See Beat 3.** |
| 6 | Gateway → Reference | What else can API Management do? | Scrolls — see below |
| 7 | **Observability** → Record | What was asked, and what was answered? | |
| 8 | Observability → Measurements | What did this request cost? | The per-hop waterfall |
| 9 | **Platform** | What is deployed, and what does the operations team administer? | |

Everything in this console is on one of those nine screens. If you find yourself hunting for something mid-demo, it is on this table.

**Where the environment and the mode indicator went.** They are in the rail's footer, permanently: the current agent, the Live/Simulation dot with the region and resource group, and the gear. You no longer have to leave a screen to check which deployment you are on, and neither does the room.

**The settings drawer** (gear, bottom of the rail) opens with **Maintenance first** — eight actions including `ping`, `warm-agent`, `test-apim` and `reload-policies`. Those last two used to sit on the Gateway screen; they are presenter instruments, so they are in the presenter's menu now.

**One screen scrolls, and only one.** Gateway → Reference is reference material about API Management as a product, not a reading of this deployment, and it is longer than a screen on purpose. You can scroll it calmly with the room — that is a declared exception (`DESIGN_DECISIONS.md` §4.9), not a layout fault. Every other screen fits without scrolling at 1366×768; if one of them ever does not, that is a bug worth reporting, not something to scroll past.

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

## 2. Gateway → Live (4:00 – 6:15) — the two hops

**Customer question this section answers:** *"How do clients reach the agent, and who controls that?"*

In most conversations, this is the section that decides whether the customer stays interested. Take your time.

**On screen:** the Gateway section, showing how traffic is routed to the agent.

**Script:**

> "Here's the core idea behind this whole architecture: Azure API Management appears **twice** in the path of a single request. The first time, at the front — the client never talks directly to the agent, it talks to APIM. The second time, when the agent itself needs to call the model — that call also goes through APIM before it reaches `gpt-5-mini`.
>
> Most architectures only govern the front door and leave the traffic the agent generates toward the model uncontrolled. Here, both directions cross the same control point the platform team already owns."

Point at the routed URL above the diagram:

> "The agent's name is a path segment in that URL. That is why one API serves any number of agents — deploying the tenth one changes no gateway configuration at all."

**Key message to close this beat:**

> "In this implementation, all of this adds single-digit millisecond latency per hop — compared to the several seconds the model generation itself takes. Putting a governed control point in the path costs no noticeable performance."

Then say the sentence that carries you into the next beat, so you cannot
arrive at the wrap-up having skipped it:

> "So that is *where* the request goes. The other half of the question is *who is allowed to send it* — and I can show you that live rather than describe it."

---

## 3. Gateway → Credentials (6:15 – 8:00) — the 401, and the only green in the console

> **This beat is not optional, and it has its own tab for a reason.**
>
> The three-credential test used to sit at the bottom of the Live screen. It
> does not any more: at the 16px projector floor, Live and Credentials do not
> fit on one screen — measured, twice, under two different layouts
> (`DESIGN_DECISIONS.md` §4.8). The upside is a screen that fits. The cost is
> that **the 401 is now a destination you have to go to**, and a presenter who
> forgets the tab exists will finish the Gateway section without ever showing
> the single most persuasive thing in the demo.
>
> Two ways not to forget: it is **#5 on the map** in the checklist above, and
> pressing **`S` from anywhere** runs the three attempts *and* takes you there.
> If you remember one shortcut for the whole demo, make it this one.

**Customer question this beat answers:** *"Who is allowed to call the agent, and what happens to everyone else?"*

**On screen:** Gateway → **Credentials**.

**Script:**

> "The client only needs an API Management subscription key — not an Azure AD credential, not a Foundry key, not a model key. APIM exchanges that key for a managed identity token, generated per request and never stored."

**Live demo — the three-credential test** (`Run all three`, or shortcut `S`):

> "I'm going to try three ways of reaching the agent right now, live."

Run the test and narrate the result as it appears. Slow down here — three
outcomes land in about a second and a half, and the room needs to read them:

> "With the subscription key: 200, it works. Without the key: 401, rejected by APIM before the request ever reaches Foundry. Going straight to the Foundry endpoint, bypassing the gateway: also 401, because there's no Azure AD token. Those two rejections are the expected outcome, not an error — they're proof the perimeter is actually doing its job."

If you want one line to leave in the room, it is this one:

> "Nothing on this screen is staged. Those are three real HTTPS requests made just now, and the gateway decided each one."

**Reveal the XML policy** (`Show the live policy`):

> "This is the policy running on the gateway right now — not a sample file, but what Azure Resource Manager is returning at this very moment. This is where the managed identity token gets acquired and the authorization header gets overwritten before the request is forwarded."

**A note on what you are looking at, if you present often:** green appears
exactly once in this entire console, and it is the shield on those rejections.
Everything else that is "on" — a running agent, live status, an enforced
control — is blue. That is deliberate: when the room sees green, it means
something was *refused*, and it should mean nothing else.

**If someone asks "what else can API Management do?"** — that is the
**Reference** tab, the third one. Say plainly that it is product capability
material and not a reading of this deployment; the console says so too, with a
dashed frame, a banner and a "used here / not in this lab" pill on every item.
It is also the one screen you can scroll calmly (§4.9).

---

## 4. Observability (8:00 – 10:30)

**Customer question this section answers:** *"What evidence does the platform generate?"*

**On screen:** Observability → **Record**. This section has two tabs, and the beat uses both — Record answers *what was asked and answered*, Measurements answers *what it cost*. They are separate because they come from different queries and different people care about them: a compliance function wants the first, an architect wants the second.

**A timing note worth knowing before you present.** Log Analytics ingests the gateway's logs one to three minutes after an answer. If you come here immediately after asking, the per-hop numbers will honestly say they are not available yet rather than estimate — that is the console working correctly. Ask your question during the Agents beat and this section will be populated by the time you reach it.

**Script:**

> "None of this data was added by writing extra code inside the agent. The Bicep deployment already creates the Log Analytics workspace and Application Insights, and connects API Management to both — so the gateway itself writes the full prompt, the full response, the token count, and the duration of every hop."

Switch to the **Measurements** tab and show the per-hop waterfall, then open `Technical details` for the span timeline:

> "This is a real distributed trace, not a reconstruction from timestamps. You can follow a single request through the gateway, through the Foundry runtime, and into the agent's container — including the exact moment the managed identity token is acquired, which shows up here as its own span."

**Key message to close the section:**

> "For a compliance or risk function, this is what actually matters: not a promise that everything is being logged, but the evidence that it already is — with two independent sources, the gateway and the container's own instrumentation, that agree with each other."

---

## 5. Platform (10:30 – 12:30)

**Customer question this section answers:** *"What's deployed, and what does the operations team manage?"*

**On screen:** the Platform section, showing the controls catalog.

**Script** — point at the rail's footer rather than the stage, because that is where the environment now lives, permanently and on every screen:

> "Here's the real environment, and it has been on screen this whole time: region, resource group, and the resource count that Azure Resource Manager returns right now — not a manually documented figure."

Show the controls catalog, highlighting the three categories:

> "This catalog has three states, and that distinction is deliberate. **Active** are controls evidenced by the request we just made — click any one of them and it cites the exact observation that proves it, down in the strip below the list. **Available** are controls that this same control point supports but aren't turned on in this environment — rate limiting, semantic caching, private networking, Entra-only authentication, secrets management with Key Vault. Turning them on is a configuration change on a gateway the company already owns, not a rebuild.
>
> And whatever isn't on this list at all, I'll tell you directly instead of letting you guess."

If time allows, run one of the maintenance actions live from the settings drawer (gear at the bottom of the rail — for example, **Refresh Azure status**):

> "These are the same checks an engineer would run before a session — here they're a click away, against the real infrastructure."

---

## 6. Wrap-up (12:30 – 14:00)

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

- [`APIM_CAPABILITIES_GUIDE.md`](APIM_CAPABILITIES_GUIDE.md) — optional 4–6 minute closing module on what API Management offers beyond this lab. Reference material, explicitly not a reading of this deployment.
- [`PURPOSE.md`](../01-general/PURPOSE.md) — the full goal, scope, and philosophy.
- [`COPILOT_CONTEXT.md`](../01-general/COPILOT_CONTEXT.md) — the exact instructions the built-in assistant follows.
- [`FAQ.md`](FAQ.md) — suggested answers to typical tough customer questions.
- [`PRESENTATION_FLOW.md`](PRESENTATION_FLOW.md) — a quick view of timing and key messages, without the full script text.
- [`README.md`](https://github.com/Azure-Samples/AI-Gateway/blob/main/labs/ai-foundry-hosted-agents-custom-framework/README.md) (official lab, external) — the official Microsoft lab description.
