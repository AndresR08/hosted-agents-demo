# Guide: the API Management reference screen

An optional **4–6 minute** closing module, for after the walkthrough in [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md). Read that first: this guide assumes the full script and does not repeat it.

Its job is to move from *"here is what we built"* to *"here is everything the platform allows if you need it"* — without breaking the one rule the whole demo's credibility rests on.

---

## ⚠️ First: what this screen is, and what it is not

**It is reference material about the Azure API Management product. It is not a reading of this deployment.**

Of the eight capabilities it lists, this lab configures three. The other five are there because they are part of the product the customer would be buying, not because they are switched on right now.

The screen defends itself: it lives in its own tab (Gateway → **Reference**), carries the `Illustrative` badge instead of `Live`, has a permanent banner saying so, and every capability shows a **"Used here"** or **"Not in this lab"** pill.

Even so, **saying it out loud is your job**. The sentence that settles it, best delivered *before* you show the screen:

> "Let me change register for a moment. Everything so far was live. What comes next is product catalogue — I'll mark explicitly what's switched on in the lab and what isn't."

Say that, and the screen works for you. Skip it, and you are presenting a brochure as if it were a deployment, which is precisely what the rest of the demo refused to do.

---

## When to use it (and when not to)

**Use it when:**
- The room is technical and has already asked "what else does this do?".
- The customer already owns APIM and wants to know what they are leaving unused.
- You have 5 minutes to spare after the close and there is appetite for more.

**Skip it when:**
- The audience is executive and the conversation is about business value, not capability lists.
- You are short on time. The close in `PRESENTATION_GUIDE.md` §5 is a better ending than a half-delivered catalogue.
- Someone already asked about a specific capability — answer it there, in the section it belongs to, rather than saving it for this module.

---

## Script, section by section

One or two sentences per capability. **Focus on the problem it solves, not the feature name** — a customer does not buy "rate limiting", they buy "one consumer can't take down my service".

### Traffic management
> "Limits per consumer: how many calls a minute, how many a month. It stops an internal team with a runaway loop from spending everyone else's token budget. And the circuit breaker stops sending traffic to a backend that has started failing, instead of hammering it."

### Security and authentication
> "Here's the real anchor: what you just saw working is two of these schemes — the revocable key inbound and managed identity outbound. The full list includes OAuth2 with JWT validation, client certificates, IP filtering. They combine per API, so the caller's credential and the backend's credential don't have to be the same thing."

*(This is the one section where you can point at something live: the real policy is on the **Live** tab, in the policy viewer.)*

### Transformation
> "The contract you publish to your consumers doesn't have to be your backend's contract. You can expose JSON over a backend that speaks XML, or rewrite headers and paths. This lab already does a small version of it: it rewrites three headers to talk to Foundry."

### Multiple backends
> "One endpoint, several backends behind it: load balancing, versions, and canary releases — send 5% of traffic to the new version and watch it before moving everyone. The client never knows and never changes."

### Response caching
> "If the same question arrives twice, the second one doesn't have to reach the model. On a per-token backend that isn't just latency — it's the invoice."

### Developer Portal
> "If tomorrow you want to expose these agents to other parts of the bank, or to an external partner, there's a self-service portal where consumers discover the API, read the docs and request their own subscription. You don't have to build it."

### Analytics and observability
> "This one you did see live, two minutes ago, in the Observability section. Everything measured there comes from the gateway, with no backend instrumentation."

### Multi-cloud and hybrid
> "The same gateway runs as a container in your datacentre or another cloud, managed from the same control plane. One set of policies over backends that aren't in Azure — which is usually the reality."

### Tier comparison
> "And an example that these decisions have measurable consequences, not theoretical ones. We tested both tiers on this same architecture. Consumption costs essentially nothing idle, but we measured 54 seconds on the first call after 35 minutes of no use. For a test environment created and destroyed the same day, that's the right choice. For a session like this one, with you watching, it isn't."

**Why this section is worth more than all the others:** it is the only figure on the screen that is not in Microsoft's documentation. It is our own measurement, on the architecture they are looking at. That is the kind of thing that separates someone who deployed this from someone who read the datasheet.

### How the model is chosen
See the next section — it is a question we were asked, not a catalogue item.

---

## Anticipated questions

### "How does APIM know which model each agent uses?"

**A real question, already asked by a solutions architect.** The intuitive assumption — that APIM routes per agent — is wrong, and letting it stand leads a customer to design routing rules they do not need.

**Answer, ready to say out loud:**

> "It doesn't know, and it doesn't decide. When we register the agent we inject the deployment name as an environment variable; the framework puts it in the request URL, and APIM acts as a generic proxy: it reads where the call is going from the URL, injects the managed-identity token and forwards it. There's no 'this agent uses this model' logic anywhere in the gateway."

If they want the detail, the full chain is: `deploy.ps1` injects `AZURE_OPENAI_DEPLOYMENT` and `AZURE_OPENAI_ENDPOINT` → the framework (Pydantic AI / Strands) builds the OpenAI-compatible path → APIM proxies. It is drawn on the screen.

### "So can I change the model without redeploying the agent?"

The likely follow-up. **The honest answer is no**, and it is best given plainly:

> "Not hot. The environment variable is part of the agent version's definition, so changing model means creating a new version with the updated value. It takes seconds and you get a versioned record of it, but it isn't a runtime switch."

*(If they ask whether that can be solved: yes, with routing at the gateway — which is exactly one of the "multiple backends" capabilities on this screen. But this lab doesn't do it, and saying otherwise would be inventing.)*

### "Can I see the rate limiting / caching actually working?"

> "It isn't configured in this lab, so I can't show it to you working here — and I'd rather tell you that than improvise a screen. It's policy configuration, not an architectural change. If it's of interest, I'll show you in a separate lab or against the documentation, with your team."

**Never** open the Azure portal to improvise a policy live. A syntax error in front of the customer costs more than the demonstration is worth.

### "Do I already have this if I bought APIM?"

It depends on the tier, and the table on the screen is the short answer: the developer portal and the self-hosted gateway are not in every tier. If you are not certain, say so and confirm afterwards — it is a commercial question with a public answer, not worth guessing at.

---

## See also

- [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md) — the full walkthrough script.
- [`FAQ.md`](FAQ.md) — the hard questions from the rest of the demo.
- `labs/…-automation/docs/06-apim-consumption.md` (repository) — the full cold-start measurement, including the two ways to measure it wrong.
