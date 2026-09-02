# Adopting the Foundry IQ visual language

Phase 0 (extraction) and Phase 1 (navigation proposal) for moving demo-app to
the visual language of the `foundry-iq-dashboard` reference — a Flask + vanilla
JS dashboard from a different project.

**Nothing here is implemented.** This is the document to approve or reject
before any component connected to real data is touched.

The reference was read as `static/index.html` and `static/js/script.js` only.
Its `.env` was never extracted, read or referenced: it carries live credentials
for an unrelated system and has no bearing on a visual audit.

---

# Phase 0 — What the reference actually is

## 0.1 The single most important fact about it

**The reference has no dark theme.** A search for `prefers-color-scheme` or any
dark variant returns nothing. It is a light-only dashboard with a permanently
dark sidebar.

demo-app has a complete light/dark system, and `DESIGN_DECISIONS.md` §4.5 makes
it a requirement, not a preference: *"A dark variant is required, because
boardroom lighting varies and that preference isn't ours to assume."*

So this is not an extraction. **Half of the palette does not exist in the
reference and would have to be designed.** Every colour below is a light-mode
value with no dark counterpart, and the dark half is original work that the
reference cannot validate.

## 0.2 Palette

| Reference | Value | Nearest existing token | Verdict |
|---|---|---|---|
| `--bg` | `#F5F7FB` | `--color-canvas` `#fafafa` | **Adopt.** A cool tint at the same lightness; keeps §4.5's "never pure white" rule. |
| `--card` | `#FFFFFF` | `--color-surface` `#ffffff` | Identical. No change. |
| `--border` | `#E7ECF3` | `--color-border` `#e5e5e5` | **Adopt.** Same weight, cooler. |
| `--ink-900` | `#0F2547` | `--color-ink` `#1a1a1a` | **Adopt.** Navy-black rather than neutral; more product, less terminal. |
| `--ink-500` | `#6B7A99` | `--color-ink-muted` `#6b6b6b` | **Adopt**, but verify contrast — see below. |
| `--ink-300` | `#A4AFC3` | *(none)* | **New token needed** if the KPI sub-line is adopted. Fails contrast as body text; only admissible for non-essential text. |
| `--blue-500` | `#2F6FED` | `--color-accent` `#0f6cbd` | **Do not adopt.** Ours passes 5.38:1 on white; theirs is ~4.0:1. Keeping ours is the right call. |
| `--green-500` | `#16C784` | `--color-affirm` `#0e7a5f` | **Do not adopt** — see §0.6. |
| `--amber-500` | `#F2A93B` | *(none)* | **Reject** — see §0.6. |
| `--red-500` | `#EF4444` | *(none)* | **Reject outright** — see §0.6. |
| `--radius` | `14px` | `rounded-lg` `8px` | **Adopt.** Softer, more current. Low risk. |
| `--shadow` | two-layer, up to 24px blur | *(none — borders only)* | **Reject** — see §0.5. |

Contrast check on the two ink values proposed for adoption, computed against
`#FFFFFF`:

| | Ratio | Verdict |
|---|---|---|
| `#0F2547` (ink-900) | 14.5:1 | Passes comfortably |
| `#6B7A99` (ink-500) | 4.16:1 | **Fails 4.5:1 for body text** |

`--ink-500` is the reference's workhorse for labels and secondary copy. At
4.16:1 it does not meet AA, and our current `#6b6b6b` (5.33:1) does. If we
adopt the cooler hue it must be darkened to about `#5A6884` to clear the bar.
This is exactly the kind of thing the reference cannot tell us, because it was
never audited for a projector.

## 0.3 Typography

The reference loads three families: **Inter** (text), **Space Grotesk** (KPI
values), **JetBrains Mono** (technical values). demo-app currently uses one:
Segoe UI Variable.

**Recommendation: adopt one of the three, not the hierarchy.**

- **Inter → reject.** It buys nothing over Segoe UI Variable and costs a web
  font on a machine that may be presenting without reliable connectivity. The
  App Service already serves the bundle; adding a Google Fonts dependency
  introduces a failure mode a boardroom can trigger.
- **Space Grotesk for KPI values → reject.** A display face for numbers is a
  dashboard convention, and this is not a dashboard (§4.1: *"a stage, not a
  dashboard"*). Weight and size already carry that emphasis.
- **JetBrains Mono → adopt, conditionally.** demo-app already renders
  monospaced content — policy XML, container image digests, environment
  variable keys, the agent route template — with no declared mono family, so it
  falls through to whatever the OS supplies. That is a real gap, and a mono
  family is the one place where the reference is solving a problem we also
  have. Bundle it locally rather than loading it from a CDN.

**The type scale is the serious problem.** The reference runs 10.5px–13.5px for
almost everything, with 22px reserved for KPI values:

| Reference element | Size |
|---|---|
| `.kpi-sub` | 10.5px |
| `.badge`, `.kpi-trend` | 10.5px |
| `.kpi-label` | 11.5px |
| `.data-table td` | 12.5px |
| `.nav-item` | 13.5px |
| `.kpi-value` | 22px |

`DESIGN_DECISIONS.md` §4.5 sets **16px as the projector floor: never smaller**.
The reference is designed for a desk monitor at arm's length. Adopting its
scale would take demo-app from *below* the floor (F1 measured 14px carrying
83% of usage) to *far* below it, and would make F7 — the outstanding work to
reach 16px — substantially harder rather than easier.

**Adopt the reference's proportions, not its absolute sizes.** Its ratio of
label to value (roughly 1:2) is sound; applied to our floor that is a 16px
label and a 32px value, which is `--text-body` and `--text-display` — sizes we
already have and barely use.

## 0.4 The KPI card

The reference pattern is: icon (tinted square) · trend · label · large value ·
mono sub-line.

**Adopt the shape. Drop the trend element entirely.**

`DESIGN_DECISIONS.md` §1.6 classifies historical trends in the red band:
*"Historical trends (7/30/90 days) — The resource group is new, no history
exists — No trend lines anywhere."* The `.kpi-trend` element (`+12%` in green)
has nowhere to get a real number from. A card designed around a trend slot,
with the slot empty, is a worse card than one designed without it.

Where the remaining pattern has genuinely real numbers today:

| KPI | Source | Band |
|---|---|---|
| Gateway's own cost | `/api/journey` `totalGatewayOverheadMs` | live-delayed, with age |
| End-to-end latency | `/api/ask` `latencyMs` | live |
| Prompt / completion tokens | `ApiManagementGatewayLlmLog` | live-delayed |
| Registered agents | `/api/agents` | live |
| Controls enforced vs available | `/api/controls` | live |
| Resource count | `/api/environment` | live |

That is six real KPIs — enough for the pattern to earn its place without a
single filler number. The mono sub-line is the natural home for the provenance
badge, which is a genuine improvement in presentation: it gives the badge a
consistent, expected position rather than one per component's own choice.

**Cost is deliberately absent from that list.** The reference's headline card
is accumulated cost. §1.6 puts real spend in the red band (Cost Management has
8–24h latency, the resource group is too young) and the resolution is an
illustrative panel labelled as a pricing model, never an invoice. A cost KPI
styled identically to five live ones would be the single most dangerous thing
in this whole adoption.

## 0.5 Cards and elevation

The reference uses a two-layer shadow up to 24px of blur. §4.5 is explicit:
*"cards defined by a 1 px border rather than a shadow — heavily shadowed cards
read as a web template, thin lines read as a product."*

**Reject the shadow; adopt the radius.** The 14px corner is most of what makes
the reference feel current; the shadow is what would make us look like a
template. This costs nothing and the design intent survives.

## 0.6 Colour semantics — the direct collisions

The reference assigns colour by health. We assign it by claim. These are
incompatible and ours was settled two commits ago in F4.

| Reference meaning | Their colour | What we do |
|---|---|---|
| Healthy / ok / trend up | green | **Green is the 401 alone.** F4 removed it from five other uses; re-adding "healthy" would undo that in one step. |
| Warning | amber | **No amber.** We have no warning state — §4.5: *"there is no failure state meant to be communicated visually."* |
| Error | red | **No red anywhere.** §4.5, and verified after F4: zero files contain red. |
| Idle | grey | Compatible. Maps to `ink-muted`. |
| Generic KPI icon tints | blue / amber / green | **Blue only.** A tinted icon square is fine; three tints by category would reintroduce exactly the overload F4 removed. |

The badge set (`ok` / `warning` / `error` / `idle`) does not map onto our
states at all. Ours are *provenance* states — live, live-delayed, replay,
illustrative — plus the control catalogue's *enforced / not enabled / not
deployed*. Both are already implemented and verified. **The reference's badge
vocabulary should not be adopted in any form.**

## 0.7 Charts

The reference uses ApexCharts 3.45.1 for donuts and line charts.

**Do not add a chart library.** Three reasons, in order of weight:

1. We have no chart-shaped data that is real. Trends are red-band, per-consumer
   breakdown needs multiple APIM subscriptions the lab does not deploy, and
   token counts are a single number per request, not a series. A chart library
   would arrive with nothing honest to draw.
2. The bundle is already 678KB before minification warnings. ApexCharts adds
   roughly 500KB.
3. This project has twice built bespoke SVG rather than take a dependency — the
   animated request path and the identity sequence — and once rejected
   lucide-react on the same grounds. The precedent is established and it has
   held up.

If a genuinely real series appears later, the request-path diagram shows that
hand-rolled SVG is sufficient at this scale.

## 0.8 Sidebar

The one part of the reference that is straightforwardly good and has no
collision with our system.

```
.sidebar   background #0B1220, 250px fixed, flex column
.brand     icon 38px, gradient, two-line lockup
.nav-item  13.5px, radius 10px, #B9C2D6
           :hover  background #141D30, colour #fff
           .active background var(--blue-500), colour #fff
.sidebar-footer  margin-top:auto, 1px top border
.statusbar       a badge-dot plus a label
```

**Adopt structurally.** Two adjustments:

- The dark sidebar stays dark in **both** themes. That is what the reference
  does, it reads as deliberate rather than as a theme bug, and it gives the
  console a fixed anchor that does not move when a presenter switches theme
  mid-session.
- The footer status slot is where our Live / Simulation indicator should live.
  It is currently in the header and scrolls out of mind; a persistent footer
  position means the room can always see which mode is on, which strengthens
  the honesty system rather than merely relocating it.

## 0.9 Tables

`.data-table` — uppercase 10.8px headers, 12.5px cells, hover row, `.mono`
class for technical columns. Sound structure, sizes rejected per §0.3.

Worth noting we have very few tables: the tier comparison on the Reference tab
and the agent version history. This pattern is low value for us.

---

# Phase 1 — Navigation restructure proposal

## 1.1 Sidebar hierarchy

```
┌─ 250px ─────────────┐
│  ▣  Foundry          │   brand lockup
│     Hosted Agents    │
│                      │
│  ⬡  Agents           │   ← four first-level items,
│  ⛨  Gateway          │      unchanged from today
│  ∿  Observability    │
│  ▤  Platform         │
│                      │
│         ⋮            │
│                      │
├──────────────────────┤
│  ● Azure Live        │   ← moved from the header
│  swedencentral · 10  │
└──────────────────────┘
```

**The four sections stay first-level.** They are objects, not steps, and the
flat structure is one of the things the UX audit found sound: *"a lost
presenter is one click from anywhere."* Nesting them would trade that away for
nothing.

**Gateway's Live / Reference tabs do not move into the sidebar.** They are two
views of one object, not two destinations, and the distinction between them is
load-bearing — Reference is conceptual, Live is measured. Promoting Reference
to a sidebar peer would make it look like a fifth section of equal standing to
four screens that read real Azure data, which is precisely the confusion the
dashed frame and the banner exist to prevent. They stay as the sub-tab pair
inside the Gateway screen.

## 1.2 Theme and mode controls

Both currently live in the Settings drawer, reached from a gear in the header.

**Proposal: the drawer stays exactly where it is**, reached from a gear pinned
at the bottom of the sidebar next to the status line. Nothing about its
contents changes.

The reasoning is unchanged from §4.2: *"a panel labeled 'Demo Controls' tells
the audience they're watching a demo."* The sidebar footer is the least
audience-facing region of the new layout, which makes it the right home for the
presenter's private controls — the same argument that put the shortcut legend
and the reset button in that drawer during the audit.

The **Live / Simulation indicator** is different from its *control*. The
indicator becomes persistent in the sidebar footer (§0.8); the toggle stays in
the drawer and on `L`.

## 1.3 The 1366×768 budget — measured, not assumed

§4.7 requires no page scroll at 1366×768. A fixed sidebar is a direct tax on
horizontal budget, so here are the actual numbers.

| | Today | With sidebar |
|---|---|---|
| Viewport | 1366 | 1366 |
| Sidebar | — | 250 |
| Horizontal padding | 96 (48×2) | 52 (26×2) |
| **Content width** | **1270** | **1064** |

A loss of **206px, or 16%**. Against the widest things we render:

| Element | Min width | Fits in 1064? |
|---|---|---|
| Identity sequence (6 lanes × 132) | 792 | Yes |
| Request path diagram | 760 | Yes |
| Tier comparison table | 540 | Yes |
| Capability grid (2 columns) | fluid | Yes |
| Request path **with copilot open** (≈380) | 760 | **No — 684 available** |

**The last row is the real finding.** The request path already scrolls
horizontally inside its own container when the copilot is open — that was a
deliberate fix during the diagram work, chosen so the APIM policy captions
survive rather than the fit. With a sidebar it would scroll *more*, and the
copilot-open state is the normal presenting state.

Two options, and I would want your call:

- **A narrower sidebar at ≤1440px.** Collapse to a 64px icon rail, labels on
  hover. Recovers 186px, keeps the structure, costs the labels exactly when
  the presenter is least able to hunt for them.
- **Sidebar overlays instead of pushing at ≤1440px.** Content keeps its full
  width; the sidebar slides over on demand. Better for content, worse for
  orientation — the persistent anchor is most of the value of a sidebar.

Neither is free, and the mockup gives no guidance because it was never designed
for 1366 with a side panel open.

## 1.4 Should this be combined with F7?

**My recommendation: combine them, and I want to be explicit that this is the
opposite of my usual advice on this project.**

The case for combining:

- They touch the same code. F7 promotes strings from 14px to 16px and reflows
  whatever overflows; this restructure changes how much width there is to
  overflow into. Doing them separately means doing the reflow work **twice**,
  against two different content widths, and the first pass would be measured
  against a layout we are about to discard.
- §0.3 is the strongest argument in this document for *not* adopting the
  reference wholesale, and it is an argument about type size. Adopting the
  reference's card and sidebar language while still sitting below the projector
  floor would lock in the reference's desk-monitor assumptions at exactly the
  moment we have the layout open.
- The 1064px budget in §1.3 is computed against today's 14px. At 16px every
  min-width in that table grows by roughly 14%. **The fit analysis above is
  invalid unless F7 is decided one way or the other**, which is the sharpest
  reason they are not really separable.

The case against, which is real: it makes one large change into one larger
change, and F7 was deferred precisely because it is the item most likely to
break something already verified against live Azure.

**How I would de-risk it:** sequence the work so the honesty system and the
data path are never in flight at the same time as the layout. Tokens and the
type scale first, verified. Then the sidebar shell with the existing screens
dropped into it unchanged, verified. Then per-screen reflow, one commit per
screen, with the Gateway numeric comparison repeated on the screen that has it.
That is four or five verifiable checkpoints rather than one.

---

# Risks and objections

Stated plainly, as asked, before any approval.

**1. The reference is a dashboard and we decided not to be one.** §4.1 is
titled *"the organizing metaphor: a stage, not a dashboard"* and argues that a
surface you monitor and a surface you direct are different products. The
reference is unambiguously the former: KPI grid, chart pairs, data tables,
trend percentages. Adopting its *visual* language is defensible and I think
worthwhile. Adopting its *informational* language — filling a 4-up KPI grid
because the grid wants four — would quietly reverse a documented positioning
decision. The KPI section above lists six real numbers so this does not have to
happen, but the pull will be there on every screen with a gap in it.

**2. Half the palette does not exist.** The dark theme is original work with no
reference to check it against, and boardroom lighting is exactly why §4.5 makes
it mandatory. Budget for designing it, not extracting it.

**3. `--ink-500` fails AA at 4.16:1** and is the reference's most-used text
colour. Adopting the palette faithfully would regress contrast on the same
screens the audit just fixed.

**4. Three of the reference's five semantic colours are unusable** — red,
amber, and green-as-healthy all collide with settled decisions, two of them
settled 48 hours ago in F4. What is left to adopt is the *neutral* palette and
the *layout* language, which is still worth having, but it is a smaller
adoption than "adopt the visual language" suggests.

**5. Nothing here is verified against a projector, including our own work.**
Both the reference's scale and our current 14px are desk-monitor judgements.
F7 is the only item in either document that addresses the actual stated
constraint, which is part of why §1.4 recommends pulling it in.

**6. Production is currently correct and this is a large change.** The
deployment at `hosted-agents-demo-f76df303` is verified end to end, including
per-hop numbers matched digit for digit against the API three separate times.
Per your instruction nothing ships until you approve; I would add that the
sensible order is to keep production on the current bundle for the entire
restructure and deploy once, after a full review, rather than incrementally.
