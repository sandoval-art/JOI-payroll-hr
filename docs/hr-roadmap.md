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
- **Notifications go out both in-app AND via email** (in-app for day-to-day visibility, email so it doesn't get missed during onboarding).
- **Grace window is UI-controlled** per agent (HR sets the duration for special circumstances instead of a hardcoded value).
- If grace window expires, clock-in button is auto-disabled until HR manually re-enables.
- **A doc counts as "submitted" once HR has approved it.** Upload alone isn't enough.

Visibility: HR / Manager / Owner see everything. Agent sees their own record only.

### B. HR records on agents

Progressive discipline flow plus attendance documentation. All HR/Manager/Owner-only by default, everything surfaces in HR's admin area for the agent.

Mexican progressive discipline goes: **verbal warning → carta de compromiso → acta administrativa.** The app mirrors that escalation.

**B1. Notes and verbal warnings log (TL/Manager):**

Two entry types on a shared log:

- **Internal note** — TL/Manager jots down an observation, pattern, or concern. Not a formal disciplinary step. Visible to TL/Manager who wrote it, and to HR.
- **Verbal warning** — formal step 1 of progressive discipline. TL/Manager logs a verbal warning they've already delivered to the agent. Date/timestamp auto-applied. **Goes to HR's queue/notifications** so HR is aware of every verbal on record (feeds the escalation picture when a carta or acta comes later).

Entry fields: type (note vs verbal), agent, narrative, timestamp (auto).

**Agent visibility toggle:** each entry has a checkbox HR can flip to make it visible on the agent's own profile. Default is hidden from agent; HR decides case by case whether to expose. Useful when HR wants the agent to be formally on notice vs. when the log is internal-only.

**B2. Carta de compromiso request (TL/Manager → HR):**
TL or Manager files a request for HR to write a carta de compromiso. Form fields:
- Agent
- Date of incident
- Plain-language narrative of what happened (TL/Manager writes in their own words)

The request lands in HR's queue. HR opens it in a split-view editor:
- **Left side:** TL/Manager's original narrative (read-only, always visible).
- **Right side:** formal carta template HR fills in with court-defensible language.

HR never tab-switches to reference the source narrative. **Only HR generates the final PDF**, prints it, runs the in-person signing, and uploads the signed scan back onto the agent's profile. TLs can request; HR is the sole document custodian.

When HR finalizes and uploads the signed scan, the TL/Manager who filed the request gets notified in-app. The agent is told in-person at signing, not via app notification.

**B3. Acta administrativa request (TL/Manager → HR):**
Same flow as B2 but for actas. **TLs can file acta requests** — but same as B2, HR is the only one who writes the formal acta, generates the PDF, runs signing, and uploads the signed copy. Acta template captures witness names and signature blocks per Mexican legal requirements.

Same notification pattern as B2: HR pings the requester when it's done.

**B4. Attendance incident categorization:**
The EOD digest already knows who didn't clock in. What the TL adds is the *reason*: late, called in sick, no-call/no-show, medical leave, etc. Plus supporting docs (doctor's note for medical leave). This hangs off the existing EOD data — it's not a separate reporting flow from scratch.

**HR admin view for an agent** surfaces all four in chronological order so HR can see the escalation pattern (3 verbals → carta → acta) at a glance. Attendance incidents show on the same timeline.

**Note on templates:** JOI is sourcing the carta and acta templates separately (legal review). The app is built to accept uploaded/configured templates rather than hardcoding the legal text. Don't ship B2/B3 until the templates are ready.

### C. Policy + docs shelf

Per-agent view of:
- Company policy
- Mission/vision statement
- State-approved reglamentos
- The agent's own signed contract (readable, not editable)

**Must ship with acknowledgment tracking.** Agent clicks "I've read and agree," timestamp + version get stored. Without ack tracking, this is just a PDF viewer with no legal value and nobody will click it. Not worth building a half-version.

**Ack versioning:** when a doc gets updated (new version of the reglamento, etc.), agents re-ack the new version. **Old acks are retained, not invalidated** — a new ack record is created alongside the old one. HR can see the full history of what each agent has acknowledged and when. Protects the legal trail in disputes.

## Effort vs value

| Feature | Value | Effort | Notes |
|---|---|---|---|
| A — Compliance profile | HIGH | MEDIUM-HIGH | Legally required in MX. Build in layers (see below). |
| B — HR records | HIGH | MEDIUM | 4 sub-features. Big legal payoff for terminations. B2/B3 blocked on legal templates. |
| C — Docs shelf with ack | MEDIUM | LOW | Only worth it with ack tracking. |

## Pushbacks that shaped the plan

1. **Policy section without ack tracking was dropped.** A PDF viewer nobody reads gives a false sense of "we told them" and can actually hurt in a dispute. Ack tracking is the whole point.

2. **No unilateral formal docs by TL/Manager.** TLs can log verbals themselves and can request cartas/actas, but the formal PDF generation, in-person signing, and scan-back are HR-only. HR is the sole custodian of legally formatted documents.

3. **Split-view editor for carta/acta writing.** HR sees TL's narrative on one side, writes the formal version on the other. No tab-switching.

4. **TL attendance reporting got reframed.** The system already knows who clocked in and who didn't. The TL's job isn't to report attendance from scratch — it's to categorize and document absences the system already flagged.

5. **Compliance profile gets built in layers, not one big feature.** Shipping CURP/RFC/CLABE fields alone is a half-day of work and immediately useful. Enforcement logic takes longer and shouldn't block the data collection starting.

6. **B2/B3 blocked on legal templates.** Rather than invent the carta/acta legal text in-app, the templates come from outside (legal review). App design supports uploadable/configurable templates. Don't ship B2/B3 until JOI has approved templates in hand.

## Build order

1. **A1 — Tax/personal info fields on profile.** Fastest win. Form + DB columns. Ship this first.
2. **A2 — Required docs upload + checklist (HR-uploaded, global list, HR-approved = submitted).** Supabase Storage + RLS.
3. **B1 — Notes + verbal warnings log (with type field + agent-visibility toggle + HR notification on verbals).** Single table with a type enum.
4. **B4 — Attendance incident categorization.** Rides on existing EOD data.
5. **B2/B3 — Carta + acta request flow with split-view editor + template engine + signed-scan upload.** Bigger. Blocked on templates being ready.
6. **A3 — Grace window (UI-controlled) + clock-in lock.** The enforcement layer. Needs A1 and A2 done first.
7. **C — Policy shelf with ack tracking.** Last, and only if ack tracking is part of it.

## Open questions to answer before building

All design questions resolved as of 2026-04-19. Build is unblocked for A and B1/B4. B2/B3 is gated on JOI receiving legal-approved carta and acta templates (external work, not a design question).

## What's parked / not happening yet

Nothing on the original six-item list got dropped except the "policy section without ack tracking" version. If ack tracking ends up being too heavy for the first pass, revisit whether to ship a Drive folder link as a stopgap instead of building C half-way.

## Followups

- **Harden RLS on employees table for sensitive fields (curp, rfc, bank_clabe).** Currently protected at UI layer only — any authenticated user can read/modify another employee's tax info via direct Supabase calls. Should be tightened so agents can only SELECT their own row, and only leadership roles (admin/manager/owner) can UPDATE. Added during A1 (2026-04-19).

- **Enforce clock-in lock server-side.** Currently protected at UI layer only — a non-compliant agent past grace could bypass via direct Supabase insert into time_clock. Add a BEFORE INSERT trigger on time_clock that checks employees.compliance_grace_until and doc approval state, rejecting inserts for locked employees. Added during A3a (2026-04-19).

- **Re-rejection emails suppressed by dedupe.** Current dedupe key uses the document row's UUID, but A2b's upload UPSERT reuses the same row across re-uploads. Second rejection of the same doc row won't fire a new email. Fix with a trigger that deletes the rejection dedupe row when employee_documents.status changes away from 'rejected', OR extend the dedupe key to include reviewed_at. Added during A3b (2026-04-19).

- **Migration history cleanup + restore `supabase db push` in CI.** The repo has a pre-existing filename collision at `20260417000001` (both `eod_digest_sending_infra.sql` and `tl_per_campaign.sql` share that version) plus drift between local files and remote Supabase tracking. The Deploy Supabase workflow currently skips `supabase db push` for this reason — migrations are applied manually via MCP after merge. Cleanup: rename one of the colliding files, reconcile the `supabase_migrations.schema_migrations` tracking table to match local filenames exactly, then re-enable the `db push` step in `.github/workflows/supabase-deploy.yml`. Added 2026-04-19.

- **Orphan supporting docs in attendance-docs bucket on replacement.** Same pattern as B-03 — replacing an incident's supporting document via useUpdateIncident uploads a new path but leaves the old file in storage. Fix with pre-upload cleanup. Added during B4 (2026-04-20).
