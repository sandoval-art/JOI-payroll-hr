# HR Feature Roadmap

Last updated: 2026-04-21

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

1. **A1 — Tax/personal info fields on profile.** Fastest win. Form + DB columns. Ship this first. ✅ SHIPPED.
   - **A1b — Expanded employee record.** Added 9 more employee fields (work_name, personal_email, hire_date, emergency_contact, bank_name, DOB, marital_status, NSS, last_worked_day) + `departments` catalog table with HR admin UI at `/settings/departments`. Seeded 11 departments. `employees.department_id` nullable pending backfill; NOT NULL enforcement is a follow-up. All new columns excluded from `employees_no_pay` view (sensitive). ✅ SHIPPED 2026-04-21 (PR #33).
   - **A1b backfill — 45 employee records populated from PDF.** Decision: `full_name` = legal name (for legal docs), `work_name` = short/preferred name (for UI). DOB sourced from CURP positions 4-9 (government-encoded, authoritative). 12 real employees not in PDF stayed untouched. Applied via MCP (not a PR). ✅ APPLIED 2026-04-21.
   - **A1b display layer — work_name in UI, DD/MM/YY dates.** `getDisplayName()` helper, `formatDateMX()` / `formatDateMXLong()` helpers, `work_name` exposed through `employees_no_pay` view, UI sweep of rosters/cards, EOD digest + compliance emails use work_name in recipient-facing parts. ✅ SHIPPED 2026-04-21 (PR #34).
2. **A2 — Required docs upload + checklist (HR-uploaded, global list, HR-approved = submitted).** Supabase Storage + RLS. ✅ SHIPPED.
3. **B1 — Notes + verbal warnings log (with type field + agent-visibility toggle + HR notification on verbals).** Single table with a type enum.
4. **B4 — Attendance incident categorization.** Rides on existing EOD data.
5. **B2/B3 — Carta + acta request flow with split-view editor + template engine + signed-scan upload.** Phase 1 shipped (schema, PR #42). Phase 2 shipped (TL request form, PR #43). Phase 3 shipped (HR queue + status transitions, PR #44). Phases 1–4 + 5a shipped (schema PR #42, TL form PR #43, HR queue PR #44, editor shell PR #45, KPI+witnesses+reincidencia PR #46, PDF generation PR #47). Phase 5b queued: signed-scan upload + status→fulfilled + TL/agent viewing.
6. **A3 — Grace window (UI-controlled) + clock-in lock.** The enforcement layer. Needs A1 and A2 done first.
7. **C — Policy shelf with ack tracking.** Last, and only if ack tracking is part of it.

## Open questions to answer before building

All design questions resolved as of 2026-04-19. Build is unblocked for A and B1/B4. B2/B3 is gated on JOI receiving legal-approved carta and acta templates (external work, not a design question).

## What's parked / not happening yet

Nothing on the original six-item list got dropped except the "policy section without ack tracking" version. If ack tracking ends up being too heavy for the first pass, revisit whether to ship a Drive folder link as a stopgap instead of building C half-way.

## Followups

- ~~**Harden RLS on employees table for sensitive fields (curp, rfc, bank_clabe).**~~ SHIPPED in PR #32 (2026-04-21). Migration `20260421100001_a1_harden_employees_rls.sql`: agents SELECT own row only, leadership UPDATE only. `employees_no_pay` view switched to `security_invoker=off` with role-scoped WHERE. Added during A1 (2026-04-19).

- ~~**Enforce clock-in lock server-side.**~~ SHIPPED in PR #37. BEFORE INSERT trigger `enforce_clock_in_compliance` on `time_clock` rejects inserts for employees past `compliance_grace_until` with unapproved/missing required docs. SQLSTATE P0001 surfaced to UI via existing error path. Added during A3a (2026-04-19).

- ~~**Re-rejection emails suppressed by dedupe.**~~ SHIPPED in PR #38. AFTER UPDATE trigger `clear_compliance_dedupe_on_rerejection` on `employee_documents` deletes the dedupe row in `compliance_notifications_sent` when status transitions away from `'rejected'`. The reviewed_at key-extension approach was rejected (stale row accumulation). Added during A3b (2026-04-19).

- ~~**Grace-driven dedupe rows not cleared on compliance_grace_until change.**~~ SHIPPED in PR #39. AFTER UPDATE trigger `clear_compliance_dedupe_on_grace_change` on `employees` deletes reminder_7d/3d/1d/lock dedupe rows when `compliance_grace_until` changes. Does NOT clear rejection rows. Mirrors A3b pattern. Added during old-B-05 (2026-04-21).

- **Migration history cleanup + restore `supabase db push` in CI.** The repo has a pre-existing filename collision at `20260417000001` (both `eod_digest_sending_infra.sql` and `tl_per_campaign.sql` share that version) plus drift between local files and remote Supabase tracking. The Deploy Supabase workflow currently skips `supabase db push` for this reason — migrations are applied manually via MCP after merge. Cleanup: rename one of the colliding files, reconcile the `supabase_migrations.schema_migrations` tracking table to match local filenames exactly, then re-enable the `db push` step in `.github/workflows/supabase-deploy.yml`. Added 2026-04-19.

- ~~**Employee Record form state clobbered by TanStack refetch.**~~ SHIPPED in PR #41. Added a `useRef` dirty flag to the taxForm sync effect in EmpleadoPerfil — skips server→state sync while user has unsaved edits, resets on save success. Added during old-B-02 (2026-04-21).

- ~~**Orphan employee-documents files on re-upload.**~~ SHIPPED in PR #40. `useUploadDocument` now fetches the old `file_path` before upload and deletes the orphan from Storage after the UPSERT succeeds. Best-effort cleanup (remove failure logged, does not roll back upload). Added during old-B-03 (2026-04-21).

- **Orphan supporting docs in attendance-docs bucket on replacement.** Same pattern as B-03 — replacing an incident's supporting document via useUpdateIncident uploads a new path but leaves the old file in storage. Fix with pre-upload cleanup. Added during B4 (2026-04-20).

- **usePolicies fetches all policy versions to dedupe latest client-side.** `.from("policy_document_versions").select("*").order("version_number", desc)` pulls every version across every policy, then filters in JS. Works at current scale (few policies × few versions), but scales poorly. Switch to a DISTINCT ON view or Postgres window-function query if the table grows. Added during C1 (2026-04-20).

- **Orphan policy files on version bump.** Same pattern as B-03 and B4-orphan — publishing a new version uploads the new file but leaves all prior version files sitting in the policy-documents bucket forever. This is actually intentional for policies (version history must preserve the file contents an agent ack'd), so this entry is really "storage grows unbounded; no cleanup job exists." Not urgent. Added during C1 (2026-04-20).

- **A1b — PDF backfill of employee record fields.** Source: `JOI Complete Workers Information 2026 - 2026 (1).pdf` (47 employees with work_name, hire_date, emergency_contact, bank_name, DOB, marital_status, NSS). Apply via dev-seed SQL or a follow-up migration. Once backfill + manual department assignment are complete, a follow-up migration should flip `employees.department_id` to NOT NULL. Added during A1b (2026-04-21).

- **A1b — EmployeeHome direct-supabase query diverges from mapEmployee pattern.** `src/pages/EmployeeHome.tsx:144` issues a direct `supabase.from("employees").select(...)` with snake_case handling instead of routing through `mapEmployee` like the rest of the codebase. Functional and RLS-protected (agent only sees own row), but worth consolidating in a cleanup pass. Added during A1b (2026-04-21).

- ~~**A1b display layer — date formatting sweep incomplete.**~~ ✅ SHIPPED 2026-04-21 (PR #35). ~30 date display sites across 12 files converted, plus display-name cleanup for EmpleadoPerfil header and Policies uploader, plus 5 new `getDisplayName` tests.

- **Performance.tsx TZ drift.** `new Date("YYYY-MM-DD")` at line 227 parses as UTC midnight → returns prior day in Mexico (UTC-6). Pre-existing; now also affects `formatDateMXLong(dateObj)` output. Fix by switching to `parseLocalDate()` helper from `src/lib/localDate.ts`. Not urgent. Added during PR #35 date sweep (2026-04-21).

- ~~**A1b display layer — TL data layer + greeting missing work_name.**~~ ✅ SHIPPED 2026-04-21 (PR #36 + fix commit 182680e). `useTeamLead` selects extended with `work_name`, 7 interfaces carry `workName`, TeamLeadHome greeting + 4 display sites use `getDisplayName`. Follow-up fix commit added missing select in `useUnderperformerTrend` that `replace_all` skipped due to `roster ?? []` vs `|| []` variance.

**✅ A1b FULLY COMPLETE 2026-04-21.** Four PRs shipped: expanded record (#33), display layer (#34), date sweep (#35), TL data layer (#36). Plus PDF backfill applied via MCP.

**✅ HR hardening round 2 COMPLETE 2026-04-21.** Five additional PRs closed out every audit followup:
- PR #37 (A3a) — `enforce_clock_in_compliance` BEFORE INSERT trigger on `time_clock`.
- PR #38 (A3b) — `clear_compliance_dedupe_on_rerejection` AFTER UPDATE trigger on `employee_documents`.
- PR #39 (old-B-05) — `clear_compliance_dedupe_on_grace_change` AFTER UPDATE trigger on `employees`.
- PR #40 (old-B-03) — `useUploadDocument` deletes orphan Storage file on re-upload.
- PR #41 (old-B-02) — `EmpleadoPerfil` taxForm dirty flag prevents refetch clobber.

All migrations applied via MCP + verified live. Every small audit followup is now closed. Next substantive work: Feature D holiday calendar, or B2/B3 cartas/actas (templates in hand).

- **"Outdated ack" status not distinguished from "never ack'd" on /policies.** When an agent ack'd v1 of a policy and HR publishes v2, the agent's /policies page shows "Not acknowledged" — same label as a first-time view. Functionally re-ack works fine (creates a new row for v2), but the UX should show "A new version was published, please re-acknowledge" when the agent has prior acks on older versions of this policy. Fix: extend `PolicyDocument` with `all_version_ids: string[]` populated in `usePolicies()`, then in `getStatus()` check if any ack matches any older version ID when current isn't ack'd. Added during C2 (2026-04-20).
