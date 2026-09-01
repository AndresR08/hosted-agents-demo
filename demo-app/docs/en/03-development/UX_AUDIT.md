# Design and UX audit

Conducted 2026-09-01 against the deployed console, reading
[`DESIGN_DECISIONS.md`](DESIGN_DECISIONS.md) first and auditing the
implementation **against the system this project already declared** — not
against a generic style guide.

That framing matters, because most of what follows is not "this looks wrong".
It is "the design system says X, the code does Y, and the gap costs something
specific in a projected room."

## The two users this is judged against

1. **The presenter**, operating live while talking, under the particular
   pressure of not being able to stop and read.
2. **The room**, who only sees the screen and must understand it without
   anyone narrating the interface itself.

A finding only counts if it fails one of those two. Anything that would only
bother someone browsing alone at a desk is out of scope.

## The constraint that outranks aesthetics

The honesty system — provenance badges, the Reference tab's banner and
`tone="reference"`, the "used here" pills, `derived` / `not measured` /
`live-delayed` with the data's age — is **not** available for simplification.
Nothing below proposes removing a signal. Two findings propose carrying the
same signal *more legibly*, and they are marked as such rather than filed as
cleanups.

---

# Phase 1 — Findings

## F1. The application is written at 13 px, below its own projector floor

**Measured.** `--text-caption` is 13 px. Across `src/`:

| Token | Size | Uses |
|---|---|---|
| `text-display` | 32 px | 1 |
| `text-body-lg` | 24 px | 2 |
| `text-body` | 16 px | 28 |
| **`text-caption`** | **13 px** | **135** |

`DESIGN_DECISIONS.md` §4.5 states: *"The 16 px base body size is the
'projector floor': never smaller."* The implementation is below that floor in
**83% of its type usage** — and not for chrome. 13 px currently carries the
per-hop latency numbers, the node captions that name each APIM policy and
audience, every capability card's body copy, the tier comparison table, and
the sequence step descriptions. That is the content the room is supposed to
read.

**Why it matters here.** A caption that is merely small on a laptop is
*unreadable* at the back of a meeting room. The signals that carry the whole
argument — `2 ms` beside `7.0 s`, `inference · managed identity →
cognitiveservices.azure.com` — are exactly the ones set smallest. The
presenter ends up reading the screen aloud, which is the failure mode the
design system was written to prevent.

**Proposal.** Raise `--text-caption` to 14 px. It is one token, it lifts all
135 sites at once, and 14 px is still visibly subordinate to the 16 px body —
the hierarchy survives. Verify no screen gains a scrollbar, since "no page
scroll" is a hard constraint (§4.7).

*This does not reach 16 px.* Genuinely honouring the stated floor means
promoting individual strings and rebalancing layouts, which is F7.

---

## F2. Nine screens project raw broker errors at the client

**Measured.** The pattern `{t("assistant.liveError")} ({error})` appears in
nine components: `AgentOverview`, `AgentRun` (×2), `AgentsList`,
`AgentVersions`, `CreateAgentDialog`, `DeleteAgentDialog`, `CopilotPanel`.

What that renders, observed during this session's own verification:

```
Falló la llamada en vivo — verifique que el broker esté en ejecución
(Broker request failed (502) for /api/agents/pydantic-agent:
{"error":"Foundry agents list failed: 404"})
```

**Why it matters here.** §4.5 is explicit that no failure state is meant to be
communicated visually — *"a real outage falls back to Replay mode rather than
rendering an error."* In practice a transient backend hiccup puts an HTTP
status code and a JSON fragment on a screen a customer is looking at. It reads
as broken software rather than as a system that hit a slow dependency, and it
is the one moment in the session where the presenter most needs to look calm.

**Proposal — same signal, better carried.** One shared component. By default:
a single calm sentence and a "details" disclosure. Expanded: the identical raw
string, verbatim.

The detail is **not** removed. Hiding it from the presenter would be the kind
of prettification this audit is not allowed to do — the presenter needs the
502 to decide whether to switch to Simulation or retry. It stops being the
first thing the room reads.

---

## F3. The keyboard shortcuts exist and are invisible

**Measured.** `useKeyboardShortcuts.ts` binds `←` `→` `C` `S` `L` `Esc`.
A grep for any in-UI listing of them returns nothing. They are documented only
in `GUIA_PRESENTACION.md`, which is read before the session, not during it.

**Why it matters here.** §4.4 calls for the presenter menu to be driven by
keyboard "so the presenter never breaks eye contact". A presenter who blanks
on the shortcut for the credential test has no way to recover from the screen;
they either hunt for the button or drop the beat. The Settings drawer is
already the presenter's private surface, already out of the audience's line of
attention, and currently holds only language, theme and mode.

**Proposal.** A shortcuts section in the Settings drawer. No new surface, no
audience-facing chrome, no change to any data claim.

---

## F4. `affirm` now means six different things

`DESIGN_DECISIONS.md` §4.4 reserves the affirmative colour for security
rejections and calls the inversion *"the single most important semantic
decision in the entire visual system"*. Audited across `src/`, it currently
also encodes:

| Meaning | Where |
|---|---|
| Security rejection (401) — *the documented one* | `StatusPill` |
| Agent status "Running" | `AgentsList` |
| API Management's own processing cost | `RequestFlowDiagram`, `GatewayStop` |
| Identity / token steps | `IdentityFlowSequence` |
| "Azure Live" connection mode | `Header`, `LandingPage` |
| Control active in this deployment | `OperationsStop` |
| Copy succeeded, XML attribute values | `PolicyViewerDialog` |

**Why it matters here.** A frequent presenter builds an instinct for what a
colour means. When one hue means *rejected-and-that-is-good*, *running*,
*fast*, *identity*, *connected* and *enabled*, the instinct stops forming, and
the deliberate 401 inversion — the moment a sceptical CISO is supposed to sit
up — loses the exclusivity that made it land.

**Ownership:** two of these are mine, added earlier in this session
(gateway cost, identity steps). I introduced drift into the system I am now
reporting on.

**Not fixed here.** Resolving it means deciding which meanings keep the hue
and giving the others their own token, across roughly eight files including
two screens verified against live Azure this week. That is a judgement call
about the visual language, not a cleanup, and it needs the owner. See P2.

---

## F5. The "not enabled" honesty signal rides on opacity

`OperationsStop` renders controls that are *available but not configured* at
`opacity-60` over `ink-muted`. Composited, that lands near 2.6:1 — under the
4.5:1 needed for body text.

**Why it matters here.** This is an honesty signal, not decoration: the split
between "active in this deployment" and "available, not enabled" is, per §1.6,
the resolution for the entire red band. Opacity is the least projector-robust
encoding there is — it is the first thing a projector's contrast curve and a
photo of the screen destroy. The signal is correct and may not survive the
room.

**Not fixed here.** The replacement (border treatment, or an explicit pill
matching the Reference tab's vocabulary) is a structural change to that
screen. See P2.

---

## F6. There is no "reset to demo start"

§4.4 lists "reset to initial state" among the presenter instruments. `Escape`
returns to the landing page, but the store keeps `lastAskId`, `targetAgent`
and the journey timings. A second demo therefore opens with the first demo's
request path already drawn and its numbers on screen.

**Correction, recorded rather than quietly edited.** The headline claim above
was **wrong**, and implementing the fix is what proved it. `App.tsx` renders
`view === "landing" ? <LandingPage /> : <AppShell />` — returning to the
landing page *unmounts the console*, taking the copilot history and the
journey timings with it, and `startDemonstration` already cleared `lastAskId`.
A second demonstration does **not** open showing the first one's request path.

What survived that round trip were three flags, and one of them misbehaved:
`hasActiveConversation` is set when the copilot is first used and was never set
back, so the session after a copilot demo opened with a stale `true` and asked
the presenter to confirm losing a conversation that had already been
unmounted. `targetAgent` and `accessControlRunToken` also persisted.

**Fixed** as `resetDemoState()`, wired into both routes into a fresh
demonstration and exposed as an explicit button. The residual problem worth
solving was never the stale data — it was that the only way to reset at all
was a full landing-page round trip, four actions and a visible reset in front
of the client.

---

## F7. Reaching the stated 16 px floor

F1's token bump improves legibility without restructuring anything. Actually
honouring §4.5 means auditing all 135 sites, promoting the ones carrying
argument (the four per-hop numbers, the APIM node captions, the capability
bodies) to 16 px, and reflowing the layouts that then overflow — under a hard
no-scroll rule at 1366×768. Substantial, and worth doing deliberately rather
than as a side effect. See P2.

---

## What was checked and found sound

Reported so the audit is not read as a list of everything that could be said:

- **Colour contrast at the token level passes**, in both themes:
  `ink` 17.4:1 / 15.2:1, `ink-muted` 5.33:1 / 6.76:1, `accent` 5.38:1 /
  5.66:1, `affirm` 5.29:1 / 7.99:1 on their surfaces. Only the composited
  opacity in F5 falls short.
- **The provenance system is applied without exception.** Every data-bearing
  surface carries exactly one badge; no unlabelled number was found.
- **The Reference tab's separation is genuinely structural** — its own stop, a
  dashed re-skinned frame, a permanent banner, per-capability pills — and
  survives being skim-read, which was verified this session in both themes.
- **Section navigation is flat and recoverable.** Four sections, always
  visible, no nesting deeper than one sub-tab. A lost presenter is one click
  from anywhere.
- **`EmptyState` is a single shared component** at body size, centred — the
  right call, and the model F2's error state should follow.

---

# Phase 2 — Priority

## High impact / low effort — done in this pass

| | Finding | Change |
|---|---|---|
| F1 | 13 px carries the app | `--text-caption` 13 → 14 px |
| F2 | Raw broker errors projected | Shared error component, detail behind a disclosure |
| F3 | Shortcuts invisible | Shortcut list in the Settings drawer |

## High impact / high effort

F4, F5 and F6 were approved and implemented after this audit was first
written; F5 and F6 are described above with their outcomes. F7 remains
deferred to a session of its own, on the risk noted below.



| | Finding | Why it needs a decision |
|---|---|---|
| F7 | Reaching the real 16 px floor | 135 sites, layout reflow, under a no-scroll constraint. The highest-value item on this list and the one most likely to break something verified. |

## Low impact — noted, not acted on

- The header's "10 resources" is a number with no meaning to the audience; it
  proves *something* is deployed without saying what.
- `text-display` (32 px) is used exactly once. Either the scale has a size it
  does not need, or screens that should use it do not.
- `text-ink-muted/50` on the landing page is decorative but sets a precedent
  for opacity-as-hierarchy that F5 shows is fragile.
