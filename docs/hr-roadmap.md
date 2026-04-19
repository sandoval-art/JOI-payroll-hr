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

Required documents:
- Signed contract
- Plus whatever the canonical list ends up being (IDs, proof of address, etc.)
- **Document list is global** across all roles and campaigns (same list for everyone).
- **HR uploads for now.** May open self-serve upload to agents later.

Enforcement layer:
- If a required doc is missing, agent sees a flag on their profile and HR gets notified.
- **Grace window is UI-controlled** per agent (HR sets the duration for special circumstances instead of a hardcoded value).
- If grace window expires, clock-in button is auto-disabled until HR manually re-enables.
- **A doc counts as "submitted" once HR has approved it.** Upload alone isn't enough.

Visibility: HR / Manager / Owner see everything. Agent sees their own record only.

### B. HR records on agents

Progressive discipline flow plus attendance documentation. All HR/Manager/Owner-only, everything surfaces in HR's admin area for the agent.

Mexican progressive discipline goes: **verbal warning → carta de compromiso → acta administrativa.** The app mirrors that escalation.

**B1. Verbal warning log (TL/Manager):**
TL or Manager records a verbal warning they've already given the agent. Date/timestamp auto-applied. Free-form text: what was said, context, any commitments. Stays in-app — no printed doc, no signature. Visible to the person who wrote it and HR.

**B2. Carta de compromiso request (TL/Manager → HR):**
TL or Manager files a request for HR to write a carta de compromiso. Form fields:
- Agent
- Date of incident
- Plain-language narrative of what happened (TL/Manager writes in their own words)

The request lands in HR's queue. HR opens it in a split-view editor:
- **Left side:** TL/Manager's original narrative (read-only, always visible).
- **Right side:** formal carta template HR fills in with court-defensible language.

HR never has to jump between screens to reference the source narrative. Generated carta is stored on the agent's record and printable for in-person signing by the agent. Signed copy gets scanned back and attached.

**B3. Acta administrativa request (TL/Manager → HR):**
Same flow as B2 but for actas. Same split-view editor pattern. Acta template captures witness names and signature blocks per Mexican legal requirements. Printed → signed in person by agent and witnesses → scanned back into the agent's file.

**B4. Attendance incident categorization:**
The EOD digest already knows who didn't clock in. What the TL adds is the *reason*: late, called in sick, no-call/no-show, medical leave, etc. Plus supporting docs (doctor's note for medical leave). This hangs off the existing EOD data — it's not a separate reporting flow from scratch.

**HR admin view for an agent** surfaces all four in chronological order so HR can see the escalation pattern (3 verbals → carta → acta) at a glance. Attendance incidents show on the same timeline.

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
| B — HR records | HIGH | MEDIUM | Bigger than originally scoped (4 sub-features). Big legal payoff for terminations. |
| C — Docs shelf with ack | MEDIUM | LOW | Only worth it with ack tracking. |

## Pushbacks that shaped the plan

1. **Policy section without ack tracking was dropped.** A PDF viewer nobody reads gives a false sense of "we told them" and can actually hurt in a dispute. Ack tracking is the whole point.

2. **No unilateral formal write-ups by TL/Manager.** TLs can only log verbal warnings themselves. Cartas and actas are a *request to HR*, and HR writes the formal document. This separates "what happened" (TL knows) from "legal language" (HR knows) and prevents TLs from accidentally generating docs that don't hold up in court.

3. **Split-view editor for carta/acta writing.** HR sees TL's narrative on one side, writes the formal version on the other. No tab-switching.

4. **TL attendance reporting got reframed.** The system already knows who clocked in and who didn't. The TL's job isn't to report attendance from scratch — it's to categorize and document absences the system already flagged.

5. **Compliance profile gets built in layers, not one big feature.** Shipping CURP/RFC/CLABE fields alone is a half-day of work and immediately useful. Enforcement logic takes longer and shouldn't block the data collection starting.

## Build order

1. **A1 — Tax/personal info fields on profile.** Fastest win. Form + DB columns. Ship this first.
2. **A2 — Required docs upload + checklist (HR-uploaded, global list, HR-approved = submitted).** Supabase Storage + RLS.
3. **B1 — Verbal warning log.** Simplest part of B. Single table, single form, shows on agent record.
4. **B4 — Attendance incident categorization.** Rides on existing EOD data.
5. **B2/B3 — Carta + acta request flow with split-view editor.** Bigger than B1/B4. Build together since they share the request/editor pattern.
6. **A3 — Grace window (UI-controlled) + clock-in lock.** The enforcement layer. Needs A1 and A2 done first.
7. **C — Policy shelf with ack tracking.** Last, and only if ack tracking is part of it.

## Open questions to answer before building

Remaining open questions after the 2026-04-19 discussion.

**For A:**
- Notification channel when a doc is missing — in-app only, or email too?

**For B:**
- Does JOI already have a carta template and acta template from legal, or does the app need to define the format from scratch?
- Who can file a carta/acta request — TL + Manager, or Manager + Owner only? (Assumed TL can request verbals for themselves, but carta/acta escalation might be Manager+.)
- Does the agent see their own verbal warning log, or is it HR/TL-internal only?
- When HR finishes the formal carta/acta, does the agent get notified inside the app, or is it purely an in-person delivery?
- Signed carta/acta scan-back — who uploads the scanned signed copy, HR only?

**For C:**
- What triggers a new ack requirement — any edit to the doc, or only when a version is marked as major?
- Are older acks retained for history, or does a new version invalidate old ones?

## What's parked / not happening yet

Nothing on the original six-item list got dropped except the "policy section without ack tracking" version. If ack tracking ends up being too heavy for the first pass, revisit whether to ship a Drive folder link as a stopgap instead of building C half-way.
