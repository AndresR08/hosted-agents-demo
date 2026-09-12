# Adopting the Figma reference: topbar, breadcrumb, question header

Phase 0 (extraction) and Phase 1 (proposal) for the largest restructure this
project has been asked for: a new topbar layer, breadcrumbs, an informational
banner, and the reference's visual language applied across all four sections.

**Nothing here is implemented.** This is the document to approve or reject
first — the same contract `VISUAL_LANGUAGE_ADOPTION.md` ran under, and for the
same reason: the CP3 rail restructure broke the layout budget on several
screens at once and cost a full session of corrections. This document exists
so that risk is priced before any code moves.

Two inputs, of different quality, and they are not treated the same:

- **The topbar** has an authoritative spec, generated from Figma, supplied in
  the request. Its values are used verbatim where they survive review, and
  every place they do not is named below with the measurement that killed it.
- **Everything else** is one rasterised screenshot of one screen (Agents).
  Its values were **sampled from the PNG**, not estimated by eye — exact
  pixel reads and region-dominant colour counts — and every colour was then
  contrast-checked rather than trusted.

---

# Phase 0 — What the reference actually is

## 0.1 One screen, and three things that are already true

The reference covers Agents only. Before designing anything, three claims in
the request were checked against the code, because the request asked for them
to be checked rather than assumed. All three came back differently than the
request supposed, and each one **shrinks** the work:

| Request supposed | Actually true | Effect |
|---|---|---|
| Agent detail is "probably a dialog/modal" | **It is already a split view.** `AgentsView.tsx` renders a 300px `AgentsList` beside a `flex-1` detail pane with a `role="tablist"` of Resumen / Versiones / Ejecutar, always visible. The only dialogs are `CreateAgentDialog` and `DeleteAgentDialog` — create and delete actions, not detail. | The single largest structural item in the request **does not need to be built**. Agents already has the reference's architecture; what changes is styling. |
| Question-shaped headings are a new pattern to introduce | **They are the existing, enforced structure.** `StopFrame` takes `title` and `question` as required props with no fallback, deliberately: "a surface that needs a second question is a second screen, and there is no way to express it here." Every screen already renders a question. | Phase 1's "propose the question for each section" is mostly answered by the code. The four sections already have them. |
| Breadcrumb is a new layer | `StopFrame`'s `title` is already a small uppercase line directly above the question — the same slot, the same role, one segment instead of two. | Breadcrumb is a **reshape of an existing line**, not an addition. Costs ~0px. |

What is genuinely new, then, is exactly two things: **the topbar** and **the
banner**. That is the whole vertical cost, and §1.2 prices it.

## 0.2 Measured geometry

Scanned out of the PNG by colour-boundary detection, not estimated:

| | value |
|---|---|
| Topbar | `y 0 → 56`, full viewport width, `#1c1c1c` |
| Topbar accent bar | `x 0 → 6`, full 56px height, `#d4003b` |
| Rail | starts at `y 56` — **below** the topbar, not beside it — and runs to `x 252` |
| Rail active item | `y 170 → 222` (52px), `#1e293b`, with a `#d4003b` bar at `x 216 → 220`, `y 187 → 203` |
| Banner | `y 149 → 180` (31px), `#f8fafc`, `#e2e8f0` hairline top and bottom |
| Content top | `y ≈ 205` |
| **Chrome above content** | **205px** |

That last row is the number the whole proposal turns on. **Ours today is
123px** (measured live, §1.2). The reference spends 82px more before the
first pixel of content.

Note the rail: the topbar spans the full width and the rail begins beneath
it. That answers the request's question directly — the topbar is a layer
*above* the rail, not a replacement for part of it.

## 0.3 Palette, sampled and contrast-checked

The reference's palette is **Tailwind's slate scale plus one custom crimson**.
Sampled values, with the AA verdict for the use each one is put to:

| Reference | Value | Used for | Contrast | Verdict |
|---|---|---|---|---|
| topbar ground | `#1c1c1c` | topbar only | — | neutral near-black; see §1.5 |
| rail ground | `#0f172a` | rail | — | slate-900 |
| rail active row | `#1e293b` | active nav item, topbar tag | `#94a3b8` on it = 5.71:1 | passes |
| brand crimson | `#d4003b` | bar, active marker, badge, links | see below | mostly passes — §0.4 |
| page canvas | `#f1f5f9` | page background | `#1e293b` on it = 13.35:1 | passes, and **not pure white** — consistent with §4.5 |
| surface | `#ffffff` | cards, detail panel | — | |
| banner | `#f8fafc` | informational banner | `#d4003b` on it = 5.20:1 | passes |
| selected card | `#fff5f5` | selected agent card | `#d4003b` on it = 5.08:1 | passes |
| borders | `#e2e8f0` | hairlines | — | |
| muted text | `#475569` / `#94a3b8` | labels | 6.92:1 / 6.65:1 | passes |
| status green | `#10b981` / `#d1fae5` | "Running", "active" | — | **rejected — §0.6** |

**The crimson is a contrast upgrade on light grounds and a contrast failure
on dark ones.** Both halves matter:

| `#d4003b` … | ratio | |
|---|---|---|
| as text on white | 5.44:1 | passes — and beats our current `#e2196f` |
| as text on `#f8fafc` / `#f1f5f9` / `#fff5f5` | 5.20 / 4.96 / 5.08 | passes |
| **under white text** (badges, active nav pill) | **5.44:1** | passes — **better than our current pink's 4.56:1** |
| **as text on `#1c1c1c`** (the spec's own subtitle) | **3.13:1** | **fails AA** |
| as text on `#0f172a` | 3.28:1 | fails AA |
| as a decorative block on either dark ground | 3.13 / 3.28 | clears the 3:1 non-text bar |

## 0.4 The topbar spec — three conflicts with decisions already made

The spec is authoritative and was followed. Three of its values collide with
rules this project already settled, and **each needs your decision**, because
resolving them unilaterally would either break the spec or quietly reverse a
documented decision:

**1. The subtitle fails AA, twice over.** `"Azure AI Gateway · Demo Platform":
Inter 500, 10px, #D4003B` on `#1c1c1c` is **3.13:1 at 10px**. It fails the
4.5:1 text bar, and 10px is far under the **16px projector floor** §4.5 sets
and the whole F7 effort raised everything to. Three ways out, in the order I'd
pick them:

- **Recolour it `#94a3b8`** — 6.65:1, passes, and the crimson stays where it
  reads: the 6px bar and the version badge. Cheapest, keeps the layout.
- **Drop it.** The spec's own responsive rule already says the subtitle is the
  first thing to hide, which is an admission that it is the least load-bearing
  element in the bar.
- Keep crimson but lift it for dark grounds — a `brand-on-dark` stop, the same
  hue lighter. This is the precedent we already set with `--color-rail-live-mark`
  (`#4f46e5` → `#7b74ec`) for exactly this reason.

**2. 10px and 11px text reintroduce what F7 removed.** The tags are specified
at 11px, the subtitle at 10px. §4.5: *"The 16 px base body size is the
'projector floor': never smaller."* F7 spent a whole pass getting every string
to 16px. I am not going to quietly exempt the topbar from a rule stated
absolutely — but there is a real argument that a version badge is chrome, not
"content the room is meant to read from the back". **Your call**, and it has a
height consequence (next item).

**3. 40px logo + 12px vertical padding = 64px, not the specified 56px.** The
spec's own numbers do not close. And at the 16px floor, a two-line brand block
(name + subtitle) is ~42px of text, which with any padding also exceeds 56px.
The combinations that actually work:

| | height |
|---|---|
| 40px logo, 8px padding, single 16px line (no subtitle) | **56px** ✓ |
| 40px logo, 12px padding | 64px |
| two 16px lines + 12px padding | ~66px |
| spec as written (10/11px text) | 56px ✓ but fails §4.5 and AA |

**56px is achievable at the 16px floor only by dropping the subtitle.** Every
extra 8–10px of topbar comes straight out of all nine screens.

## 0.5 The rail's active item

Reference: `#1e293b` tinted row, 52px tall, with a **4×16px crimson bar on the
right edge**, vertically centred, plus a descriptive subtitle under the label
("Hosted Agents" / "Agentes desplegados").

Two notes. The request describes this as a *left* border; the image measures
it on the **right**. The image is the artefact, so the image wins unless you
say otherwise. And the subtitle-per-item is a real information gain over our
current solid-fill treatment — our four sections would read:

| | label | subtitle |
|---|---|---|
| | Agentes | Agentes desplegados |
| | Gateway | Ruta, credenciales y política |
| | Observabilidad | Evidencia de cada solicitud |
| | Plataforma | Entorno, controles y costo |

Cost: the rail grows vertically. **This is free** — the rail and the stage are
flex siblings in a fixed-height row, so rail height does not touch any
screen's budget (§4.12 established and measured this). The rail has 257px of
spare vertical space expanded.

## 0.6 Colour semantics — the collisions

| Reference meaning | Their colour | What we do |
|---|---|---|
| "Running" / "active" | green `#10b981` | **Not adopted.** Green is `--color-affirm` and `--color-affirm` is the 401 alone (§4.4/§4.5, F4). Note this is *already* how the code behaves: `AgentsList.tsx` uses `bg-accent` with the comment *"accent, not affirm: 'this is on' is the accent's documented job. Green is reserved for the 401."* Adopting crimson for Running is therefore a change from accent-blue → crimson, not from green. |
| version badge `v2.4.0` | crimson | **Cannot be adopted as shown.** `package.json` is `version: "0.0.0"` — there is no version concept in this project. A badge rendering an invented `v2.4.0` is precisely the decorative-but-false element §1.6 forbids. Either it goes, or it carries something true (see §0.7). |
| "active solution: Hosted Agents" | crimson highlight | Structurally mismatched — see §0.7. |

## 0.7 The reference is a multi-solution shell. We are one solution.

The reference's rail reads **SOLUCIONES DEMO → Hosted Agents / Panel General /
Consola / Configuración**: it is a *solution switcher*, where Hosted Agents is
one of several. Its topbar tag and its banner's "Solución activa: Hosted
Agents" only carry information in that world.

Ours is a single-solution console whose rail is a *section switcher* (Agents /
Gateway / Observability / Platform). Adopt those slots literally and they
become static decoration that never changes — and "a label that always says
the same thing" is the shape §1.6 exists to prevent.

**The repurpose is the better move, and it is nearly free:** the topbar's
right-hand slot and the banner should carry **the Live / Simulation indicator
and the deployment identity** (`region · resource group · resource count`).
That is real, it changes, it is the honesty system's single most important
persistent signal, and §1.2/§0.8 of `VISUAL_LANGUAGE_ADOPTION.md` already
argued it should be persistent. It also lets the rail footer shed that block.

---

# Phase 1 — Proposal, and the layout budget

## 1.1 Questions and breadcrumbs for the four sections

The questions already exist and are already in the shipped Spanish strings.
Nothing needs inventing:

| Section / tab | Existing question |
|---|---|
| Agentes | ¿Qué agentes tengo desplegados y en qué estado están? |
| Gateway · En vivo | ¿Cómo llegan los clientes al agente? |
| Gateway · Credenciales | ¿Qué credenciales se aceptan? |
| Gateway · Referencia | (exists; the reference-tone screen) |
| Observabilidad · Registro | ¿Qué se preguntó y qué se respondió? |
| Observabilidad · Mediciones | ¿Cuánto costó esta solicitud? |
| Plataforma | (exists) |

**Does the question apply per sub-tab or per section?** Per sub-tab, and it
already does — and that is load-bearing rather than incidental. Gateway's
three tabs answer three genuinely different questions, and §4.8's whole
argument for splitting Credentials out was that *"route, path and terms are
three arguments, and three arguments do not fit on one screen."* Collapsing
them under one section-level question would undo that. Keep it as built.

Breadcrumb, replacing the existing uppercase `title` line:

```
AZURE AI GATEWAY DEMO  /  AGENTES
AZURE AI GATEWAY DEMO  /  GATEWAY  /  CREDENCIALES
```

Two segments for sections, three where a sub-tab exists. Same slot, same
height, strictly more information than today's single `AGENTES`.

## 1.2 The layout budget — measured, and it does not fit as specified

> ### Outcome, measured after implementation (2026-09-11)
>
> **This section's estimate was wrong in one place and it cost a screen.** The
> one-line context band was priced here as replacing the banner's 52px at
> roughly zero net, merged into the breadcrumb row. It was not built merged —
> it is its own row — and measured it costs **48px** (36px of band plus a 12px
> gap), on the five screens that pass a `footer`.
>
> The consequence was Platform/Live at **−15px**: hidden content, which §4.7
> forbids. It was recovered from the shared frame (`gap-3`→`gap-2`, card
> `p-5`→`p-4`, band `py-1.5`→`py-1`, provenance `pt-2.5`→`pt-2`, `main`
> `py-4`→`py-3`) and Platform now sits at **+19**.
>
> Two of this section's input numbers were also stale. Platform/Live's content
> is **491px**, not the 120px recorded above — that row was measured while the
> panel was still loading, a 2-second settle against a backend with an ~11.4s
> warm-up. And §4.11's 457px figure is stale for the same screen. Both were
> corrected by re-measuring the baseline as an A/B (a worktree at `295a310`
> against the same live backend in the same minute), which also showed content
> is unchanged to within 2px across all nine screens.
>
> Final state and full attribution: DESIGN_DECISIONS.md §4.15.

This is the central risk and it is not a detail to check at the end.

**Measured live, today, at 1366×768 against the real backend** (production
`-v2`, real agent data loaded — earlier numbers in this session were taken
against a dead broker and understate content height):

| Screen | chrome above | budget | content | margin |
|---|---|---|---|---|
| Agentes · Resumen | 123 | 508 | 413 | **+95** |
| Agentes · Versiones | 123 | 508 | 421 | **+87** |
| Agentes · Ejecutar | 123 | 508 | 327 | +181 |
| Gateway · En vivo | 123 | 507 | 328 | +179 |
| Gateway · Credenciales | 123 | 507 | 122 | +385 |
| Observabilidad · Registro | **159** | 473 | 421 | **+52** |
| Observabilidad · Mediciones | 123 | 507 | 132 | +375 |
| Plataforma · Azure Live | 123 | 507 | 120 | +387 |
| Plataforma · Simulación | 123 | 485 | 536 | **−51** (known, §4.11) |

*(Budgets are in this document's canonical 728px frame — `clientHeight − 40` —
so they compare directly with §4.8/§4.9/§4.11. Observabilidad · Registro's
159px of chrome is its two-line question.)*

*(Gateway · Referencia measures 2171px of content in a 523px budget. That is
not a regression: it is the one deliberately long, internally-scrolling
reference document, and it is not one of the nine.)*

**Cost of the new chrome, if adopted as specified:**

| | px |
|---|---|
| Topbar | +56 |
| Breadcrumb replacing the existing title line | ~0 |
| Banner as a separate block (31px + ~21px of gaps at our type scale) | +52 |
| **Net** | **+108** |

**What that does to the nine:**

| Screen | margin today | after +108 |
|---|---|---|
| Agentes · Resumen | +95 | **−13** ✗ |
| Agentes · Versiones | +87 | **−21** ✗ |
| Agentes · Ejecutar | +181 | +73 ✓ |
| Gateway · En vivo | +179 | +71 ✓ |
| Gateway · Credenciales | +385 | +277 ✓ |
| Observabilidad · Registro | +52 | **−56** ✗ |
| Observabilidad · Mediciones | +375 | +267 ✓ |
| Plataforma · Azure Live | +387 | +279 ✓ |
| Plataforma · Simulación | −51 | **−159** ✗✗ |

**Four of nine break.** This is the CP3 failure shape repeating, and it is
the reason this document exists.

### What recovers the space

Priced individually, so you can choose:

| Change | recovers | cost |
|---|---|---|
| **Banner on one line, merged into the breadcrumb row** (breadcrumb left, active-deployment right) rather than a separate block | **+52** | the banner stops being a paragraph; it becomes a status line |
| `main` vertical padding 24 → 16 | +16 | tighter frame at 1920 too |
| `Surface` padding `p-6` → `p-5` | +8 | |
| header→body gap `gap-4` → `gap-3` | +4 | |
| **Move the footer caption sentence into the banner** — they are the same kind of sentence, and the reference's banner *is* an explanatory sentence | +22 | the footer keeps only the provenance badge |
| Move the provenance badge into the banner row too, deleting the footer row entirely | +49 total | **changes where provenance lives**, which §1.6 fixed deliberately at bottom-right. The signal survives; its documented position does not. Flagged, not recommended without your call. |

**The recommended combination — banner merged (+52), padding recovered (+24),
footer caption moved up (+22) — is +98 against a +108 cost: net +10px.**

Result at net +10:

| Screen | after |
|---|---|
| Agentes · Resumen | +85 ✓ |
| Agentes · Versiones | +77 ✓ |
| Observabilidad · Registro | +42 ✓ |
| Plataforma · Simulación | −61 ✗ (was already −51) |

Eight of nine clear with real margin. **Plataforma · Simulación does not, and
it did not before either** — it is §4.11's documented i18n defect, which that
section already says must be fixed by translating the broker's control names
and reflowing the screen. This restructure makes it 10px worse; it does not
cause it. I would fold that reflow into the same work rather than pretend the
restructure fixed or broke it.

**The single most important consequence: the banner cannot be a paragraph.**
The reference's banner is a full sentence block. At our 16px floor it costs
52px, and 52px is the difference between four screens breaking and none. If
you want the paragraph banner, the honest price is reflowing Agents and
Observability too.

## 1.3 Agent detail — no migration needed

Confirmed by reading the code rather than assuming: `AgentsView` is already
list + inline tabbed detail, always visible. There is no dialog to migrate,
and therefore no "what happens to the rest of the screen when the panel is
always visible" problem — it already always is.

What the reference changes on this screen is cosmetic: card treatment for the
selected row (`#fff5f5` fill, crimson border), the tab strip gaining a crimson
underline, and the status dot changing from accent-blue to crimson. None of it
moves the budget. **This is the cheapest part of the whole adoption.**

## 1.4 Removing the landing page — what the button actually does

Checked, because the request asked. `startDemonstration` is **not** a
navigation call. It does five things beyond navigating:

```
view          → "dashboard"
stop          → "frameworks"      (resets which screen is on stage)
copilotOpen   → false
lastAskId     → null              (drops the Observability/Platform join key)
hasActiveConversation → false
targetAgent   → "pydantic-agent"  (resets the selected agent)
accessControlRunToken → 0         (clears the 401 test results)
```

And it does something larger by side effect. `App.tsx` renders
`LandingPage` **or** `AppShell` off `store.view` — so leaving the dashboard
*unmounts the console entirely*, taking the copilot history and the journey
timings with it. `store.ts` says so explicitly: *"Most of a reset already
happens for free."*

**So the landing page is the reset mechanism between demonstrations**, not
just a welcome screen. Removing it removes the reset. Three things break:

1. The rail's **Home button** (`handleHome` → confirm dialog → `goToLanding`)
   loses its destination.
2. **`Esc`** (`useKeyboardShortcuts`, "leave the dashboard when nothing else
   claims it") loses its destination.
3. **There is no longer a way to start a clean second demonstration** in one
   session without reloading the browser.

A safe removal therefore needs a replacement, not a deletion:

- Boot straight into `stop: "frameworks"` — `App.tsx` renders `AppShell`
  unconditionally, `view`/`transitioning` retire.
- Repoint Home and `Esc` at **`resetDemoState()`** — which already exists, is
  already wired to the Settings drawer's reset button, and already clears
  exactly the demo-scoped values while deliberately preserving the operator's
  language, theme, reduced-motion and Live/Simulation settings.
- Keep the confirm dialog on Home: it guards a live conversation, and that
  reason survives.
- The copilot history and journey timings that unmounting used to clear need
  clearing explicitly — a `key` bump on the stage, or an explicit reset in
  `resetDemoState`. **This is the one piece of real work** in the removal.

The landing page also currently displays region · resource group · mode before
the demo starts. Under §0.7's proposal that information lives in the topbar
permanently, so nothing is lost.

## 1.5 One dark or two? (`#1c1c1c` topbar vs the rail)

Three values are in play: the spec's topbar `#1c1c1c`, the reference's rail
`#0f172a`, and ours today `#17132b`.

**Recommendation: unify the rail to the topbar's `#1c1c1c`.** Reasons, in
order:

1. Two near-blacks that differ slightly read as a rendering defect, not a
   decision — at 1366 on a projector the topbar/rail seam is a 56px-high
   vertical join that the eye lands on immediately. The reference gets away
   with `#1c1c1c` over `#0f172a` because its topbar is full-width and the seam
   is horizontal; ours would be too, which weakens the objection — but only if
   the rail never sits *beside* the topbar. It does not, per §0.2. So this is
   a genuine judgement call, not a forced one.
2. `#17132b` was adopted this session from a *different* reference's palette.
   It has no claim to permanence, and its whole justification was that the
   supplied palette was internally coherent — a claim that a newer, more
   authoritative supplied palette supersedes.
3. Contrast is preserved or improved: our rail ink `#f4f2f8` measures 16.23:1
   on `#17132b` and **17.4:1** on `#1c1c1c`.

**Against unifying**, and worth stating: `#1c1c1c` is a true neutral and
`#17132b`/`#0f172a` are tinted. A neutral rail loses the slight warmth that
currently distinguishes our chrome from the blue-grey stage. That is
aesthetic, not measurable, and I would trade it for one fewer arbitrary value.

## 1.6 `#D4003B` as the canonical brand red

Adopting it is a **contrast improvement**, which is the unusual case:

| | today | with `#d4003b` |
|---|---|---|
| active nav item, white label | `#e2196f` → 4.56:1 | **5.44:1** |
| brand mark on the rail | `#d50243` → 3.37:1 | 3.13:1 on `#1c1c1c` — still clears the 3:1 graphical bar |
| crimson as text on light surfaces | n/a | 4.96 – 5.44:1 |

So `#e2196f` (this session's `--color-rail-accent`) and `#b8125b` retire in
favour of `#d4003b` and a darker hover. The **logo asset keeps its own
crimson** (`#d50243`) — it is a supplied brand asset, not a token, and at
3.13:1 on `#1c1c1c` it still clears the graphical bar.

**The one place `#d4003b` must not go is text on any dark ground** (3.13:1 /
3.28:1). That rules it out for the topbar subtitle (§0.4) and for any future
crimson label on the rail.

---

# Risks and objections, before you approve

**1. The banner is the expensive element, not the topbar.** 56px of topbar is
affordable. 52px of banner-as-paragraph is what breaks four screens. If only
one thing from this document survives review, make it this.

**2. The spec asks for 10–11px text and the project forbids it.** F7 raised
every string to 16px against a stated projector floor. I have not exempted the
topbar unilaterally. If you want the spec's type sizes, that is a documented
reversal of §4.5 and should be written down as one.

**3. The version badge has nothing true to display.** `package.json` is
`0.0.0`. Either drop it or give the slot something real (§0.7).

**4. The reference's information architecture is not ours.** Its rail switches
between solutions; ours switches between sections of one solution. The
"active solution" slots are decorative in our world unless repurposed.

**5. `Plataforma · Simulación` is already broken and stays broken.** −51px
today, −61px after. This restructure is the wrong place to fix it, but it is
the right moment to schedule §4.11's translate-and-reflow work alongside.

**6. Pure white is not the canvas.** Worth stating because it is easy to
misread from the screenshot: the reference's page ground is `#f1f5f9`, not
`#ffffff` — which is consistent with §4.5's "never pure white" rule, not a
violation of it. Cards are white; the page is not.

**7. The dark theme is, again, original work.** The reference has no dark
variant. Every dark-mode value for the topbar, banner, breadcrumb and card
treatments would be designed here and checked here, exactly as §0.1 of
`VISUAL_LANGUAGE_ADOPTION.md` warned the last time.

**8. Scope reality check.** With the agent-detail migration and the question
headers turning out to already exist, the actual work is: a topbar component,
a breadcrumb reshape, a banner/status line, a palette swap, the landing-page
removal with its reset replacement, and one reflow on Platform · Simulación.
That is a substantially smaller change than the request assumed — and the
budget analysis above is the part that still deserves the caution.
