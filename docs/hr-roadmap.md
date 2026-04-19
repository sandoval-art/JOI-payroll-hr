# HR Feature Roadmap

Last updated: 2026-04-19

Brainstormed after the EOD digest system finished shipping. This doc captures what's next on the HR side, consolidates overlapping ideas, and records the pushbacks that shaped the plan.

## Why now

EOD digest is fully built and sitting in dry-run (edge function v15). That was the big blocker. HR work was parked on 2026-04-17 to avoid context-switching. With digest done, the team can move to the next layer: making sure every agent actually has a proper compliance record, a paper trail, and access to the docs they're supposed to read.

## The three features

The raw dump was six items but most of them overlap. Here's the consolidated picture.

### A. Agent compliance profile

Personal tax info + required-docs checklist + clock-in enforcement, all in one feature.

Fields on the agent profile:
- CURP
- RFC
- Address
- Phone
- Bank CLABE

Required documents (uploaded by HR or the agent, TBD):
- Signed contract
- Plus whatever the canonical list ends up being (IDs, proof of address, etc.)

Enforcement layer:
- If a required doc is missing, agent sees a flag on their profile and HR gets notified.
- Grace window (duration TBD) for the agent to submit.
- If grace window expires, clock-in button is auto-disabled until HR manually re-enables.

Visibility: HR / Manager / Owner see everything. Agent sees their own record only.

### B. HR records on agents

Two related things in the same area of the app, both HR/Manager/Owner-only.

**B1. Coaching log (in-app):**
Free-form internal notes a TL or Manager can write about an agent. Deliberately NOT called a "write-up" in the UI, because a loose note in an app is not a legally valid acta administrativa in Mexico. Framed as internal documentation and pattern-tracking.

**B2. Printable acta generator:**
When a real disciplinary event happens, HR/Manager generates a properly formatted acta PDF, prints it, gets it signed by the agent and witnesses in person, then scans it back into the agent's file. The app handles the template + storage; the legal weight comes from the in-person signing.

**B3. Attendance incident categorization:**
The EOD digest already knows who didn't clock in. What the TL adds is the *reason*: late, called in sick, no-call/no-show, medical leave, etc. Plus supporting docs (doctor's note for medical leave). This hangs off the existing EOD data — it's not a separate reporting flow from scratch.

### C. Policy + docs shelf

Per-agent view of:
- Company policy
- Mission/vision statement
- State-approved reglamentos
- The agent's own signed contract (readable, not editable)

**Must ship with acknowledgment tracking.** Agent clicks "I've read and agree," timestamp + version get stored. Without ack tracking, this is just a PDF viewer with no legal value and nobody will click it. Not worth building a half-version.

## Effort vs value

| Feature | Value | Effort | Notes |
|---|---|---|---|
| A — Compliance profile | HIGH | MEDIUM-HIGH | Legally required in MX. Build in layers (see below). |
| B — HR records | HIGH | LOW-MEDIUM | Small feature, big legal payoff for terminations. |
| C — Docs shelf with ack | MEDIUM | LOW | Only worth it with ack tracking. |

## Pushbacks that shaped the plan

1. **Policy section without ack tracking was dropped.** A PDF viewer nobody reads gives a false sense of "we told them" and can actually hurt in a dispute. Ack tracking is the whole point.

2. **"Write-up" renamed to "coaching log."** A free-text note in an app is not a legally valid acta in Mexico — those need witnesses and in-person signatures. Splitting this into in-app coaching log (B1) + printable acta workflow (B2) keeps expectations honest.

3. **TL attendance reporting got reframed.** The system already knows who clocked in and who didn't. The TL's job isn't to report attendance from scratch — it's to categorize and document absences the system already flagged.

4. **Compliance profile gets built in layers, not one big feature.** Shipping CURP/RFC/CLABE fields alone is a half-day of work and immediately useful. Enforcement logic takes longer and shouldn't block the data collection starting.

## Build order

1. **A1 — Tax/personal info fields on profile.** Fastest win. Form + DB columns. Ship this first.
2. **A2 — Required docs upload + checklist.** Supabase Storage + RLS. Agent and HR can upload; HR approves.
3. **B1/B2/B3 — Coaching log + acta generator + incident categorization.** Can ride alongside A2 since the data model is simple.
4. **A3 — Grace window + clock-in lock.** The enforcement layer. Needs A1 and A2 done first.
5. **C — Policy shelf with ack tracking.** Last, and only if ack tracking is part of it.

## Open questions to answer before building

These came up during the brainstorm and need decisions before any build starts.

**For A:**
- Canonical document list — per-role, per-campaign, or global?
- Who uploads — HR on the agent's behalf, self-serve by agent, or both?
- Grace window duration?
- What counts as "submitted" — file uploaded, or HR-approved?
- Notification channel — in-app only, or email too?

**For B:**
- Acta template format — does JOI already have a standard template from legal, or does the app need to define one?
- Who can write coaching logs — TL + Manager + Owner, or Manager + Owner only?
- Does the agent see their own coaching log, or is it HR-internal only?

**For C:**
- What triggers a new ack requirement — any edit to the doc, or only when a version is marked as major?
- Are older acks retained for history, or does a new version invalidate old ones?

## What's parked / not happening yet

Nothing on the original six-item list got dropped except the "policy section without ack tracking" version. If ack tracking ends up being too heavy for the first pass, revisit whether to ship a Drive folder link as a stopgap instead of building C half-way.
