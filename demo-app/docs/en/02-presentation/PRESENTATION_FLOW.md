# Presentation flow — quick view

One-page reference: timing, what to show on screen, and the message each segment should leave. For the word-for-word script, see [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md).

Suggested total duration: **12–15 minutes** + questions.

| Time | Segment | Customer question | On-screen action | Key message |
|---|---|---|---|---|
| 0:00–1:30 | **Introduction** | — | Home screen → click "Start executive demo" | Everything that follows is real and connected to Azure live; nothing is a mockup. |
| 1:30–4:00 | **Agents** | What do I have deployed, and what state is it in? | Agent list → Overview tab → Versions → (optional) live Run | Two different frameworks, the same type of governed asset: a Foundry Hosted Agent. |
| 4:00–6:15 | **Gateway → Live** | How do clients reach the agent? | Routed URL → request path diagram with per-hop timings | API Management appears twice in the same path: toward the agent, and from the agent toward the model. |
| 6:15–8:00 | **Gateway → Credentials** ⚠️ **mandatory beat** | Who is allowed to call the agent? | `S` from anywhere → the three attempts → live XML policy | Two real 401 rejections. The only green in the console, and the proof the perimeter works. |
| 8:00–10:30 | **Observability** (2 tabs) | What evidence does the platform generate? | Record (prompt/response) → Measurements (per-hop waterfall) → Technical details | Real end-to-end traceability, with two independent sources that agree. |
| 10:30–12:30 | **Platform** | What's deployed, and what does the operations team manage? | Controls catalog (active / available / absent) → click a control to see its evidence | What's not turned on is an explained configuration decision, not a hidden gap. |
| 12:30–14:00 | **Wrap-up** | — | Verbal recap, no clicks | Every answer came backed by Azure evidence, not a marketing claim. |

## Navigation during the presentation

The four sections live in the dark rail on the left — click to move between them, in any order. **Two of them carry sub-tabs, for nine destinations in total**; the full map is in the presenter checklist of [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md). One screen, Gateway → Reference, is longer than the viewport on purpose and can be scrolled calmly (`DESIGN_DECISIONS.md` §4.9); every other screen fits without scrolling.

Keyboard shortcuts available at any time:

| Key | Action |
|---|---|
| `C` | Open/close the built-in copilot |
| `S` | Run the three-credential test **and jump to Gateway → Credentials**. The most useful shortcut in the demo: it is the direct route to the 401. |
| `L` | Toggle between Azure Live and Simulation |
| `Esc` | Close the copilot, or return to the home screen |

## See also

- [`PRESENTATION_GUIDE.md`](PRESENTATION_GUIDE.md) — the full script, with suggested text for each segment.
- [`FAQ.md`](FAQ.md) — answers to typical tough questions.
