# Feature E — Client Portal

External client users (Torro, BTC, HFB, etc.) log in and see read-only dashboards for their own campaigns: productivity metrics, agent roster, and per-agent performance. No HR records, no salaries, no internal coaching notes. Queued 2026-04-22.

## What clients see

Confirmed scope from 2026-04-22 planning:

- Daily/weekly productivity metrics (aggregated KPIs per campaign; Torro uses full feed, BTC/HFB use agent self-report EOD logs).
- Agent roster with a single **display name** column (work_name when set, full_name as fallback — see locked design call #2). No photos, no tax info, no personal contact.
- Individual agent performance (per-agent KPI scorecards).

Explicitly **not** in scope:

- Attendance/coverage view (when who clocked in). Agents clocking in is operational noise for a client; revisit if a specific client asks.
- HR records (notes, verbal warnings, cartas, actas) — internal only.
- Employee salaries, tax info, contact details, DOB, NSS, emergency contacts — all stay strictly internal.
- Photos of agents.
- Any write access — client view is read-only.

## Data availability reality

Per the existing `project_client_data_variance.md` memory note: Torro has a full data feed from their CRM; BTC and HFB only have agent self-reported EOD data. The client portal reads from `eod_logs` as the baseline data source. For Torro, that data is authoritative because their feed fills it in; for BTC/HFB, it's agent self-report with all the usual trust caveats. The portal doesn't need to differentiate visually — the client knows how their own data pipeline works.

## Live vs. batched

Live dashboard (chosen 2026-04-22). Numbers update as EOD logs land. Clients see today + this week in real time. No scheduled reports in the first pass — revisit a weekly email digest if clients ask.

## Auth model

New `'client'` role in `user_profiles.role`. Currently the column has no CHECK constraint (role values guarded by the `guard_user_profile_role` trigger — update that trigger to accept `'client'`). Existing roles in DB: `owner`, `agent`, `team_lead`.

Client users have:

- `user_profiles.client_id` = FK to `public.clients.id` (new column, nullable).
- `user_profiles.employee_id` = NULL. Clients are not employees.
- `user_profiles.role` = `'client'`.

CHECK constraint to enforce the invariant:
```sql
CHECK ((role = 'client') = (client_id IS NOT NULL AND employee_id IS NULL))
```

Non-client users: `client_id IS NULL` AND `employee_id IS NOT NULL` (existing behavior, enforced by the same check). Client users: `client_id IS NOT NULL` AND `employee_id IS NULL`.

Leadership creates client accounts manually (no self-signup). One test client account gets seeded via MCP during Phase E1 for dev.

## Phase plan

Two phases. Keep it lean — this is simpler than B2/B3.

### Phase E1 — Data model + RLS + test client

Schema-only phase. No UI.

- Migration adds:
  - `user_profiles.client_id uuid REFERENCES public.clients(id)` (nullable).
  - CHECK constraint on user_profiles enforcing the role/client_id/employee_id invariant.
  - Updates to `guard_user_profile_role` trigger to accept `'client'` as a valid role.
  - New helpers `is_client()` (boolean) and `my_client_id()` (uuid). Mirror the pattern of `is_team_lead()` + `my_tl_campaign_ids()`.
  - New view `employees_client_view` — projects only `id`, `display_name` (= `COALESCE(NULLIF(work_name, ''), full_name)`), `campaign_id`, `title`, `is_active`. No raw `full_name` column, no tax fields, no contact, no salary, no DOB, no personal info. Use `security_invoker=off` with role-gated WHERE (same pattern as `employees_no_pay`).
  - New view `eod_logs_client_view` — exposes productivity metrics + `date` + `employee_id` + `campaign_id`. Hides coaching notes, internal amend trail, any field not client-safe. Productivity columns enumerated explicitly — never `SELECT *`.
  - RLS: `'client'` role gets SELECT-only on `clients` (own row only), `campaigns` (own client only), `employees_client_view` (scoped to campaigns for own client), `eod_logs_client_view` (same), `campaign_kpi_config` (own campaigns only).
- Seed one test client user via MCP (pick Torro or BTC, D chooses).
- Regen Supabase types.
- Add `is_client` to any existing role helper hook (e.g. `useRole`).

No UI. No hooks beyond the role flag.

### Phase E2 — Client dashboard UI

Single route `/client`, gated by `role === 'client'`. Auth routing: client users land at `/client` instead of `/` or `/home`.

- If client has multiple campaigns, campaign picker at top (default: most recent active).
- Section 1 — **This-week aggregate KPIs** for selected campaign. Cards showing key metrics (credit pulls, deals, whatever the campaign's KPI config exposes).
- Section 2 — **Agent roster** with per-agent week numbers. Display name column (sourced from `display_name` in `employees_client_view`), per-agent KPI scorecard, simple over/under-target indicator. No drill-down in the first pass.
- New sidebar for `'client'` role — minimal, just "Dashboard" + "Log out". Completely separate from the existing three menus (leadership/team_lead/agent).
- No attendance, no HR records, no pay, no admin controls.

## Design calls locked 2026-04-24

1. **One login per client.** Direct FK `user_profiles.client_id`. Multi-user-per-client deferred. If a client asks for multiple logins later, migration to a `client_users` join table is straightforward — touch user_profiles + helpers and the dashboard hooks; no view changes needed.

2. **work_name fallback exposed via `display_name` in the view.** When `work_name` is null, fall back to `full_name`. Computed in the view as `COALESCE(NULLIF(work_name, ''), full_name) AS display_name` — clients see only one name field per row, never both side by side. This is friendlier than a "—" placeholder for the 12 of 57 employees without work_name set, and tighter than exposing both columns to the UI. Privacy boundary: clients see whatever name we have on file, but cannot pivot off the legal name when a stage name exists.

3. **No EOD audit trail exposed to clients.** Clients see current approved numbers only. Internal amend history (`last_edited_at`, `edit_count`, who amended) stays internal. The client view selects only productivity columns + date + ids — explicitly enumerated, never `SELECT *`, so a future sensitive column added to `eod_logs` cannot silently leak.

## Followups after E2 ships

- Weekly email digest for clients (like EOD digest for HR, but client-facing).
- Date range picker on the dashboard (go back further than "this week").
- Export to CSV / PDF for client's own records.
- Per-agent drill-down page with daily trend.
- `client_users` join table if single-login-per-client becomes a blocker.

## Related memory

- `project_client_data_variance.md` — Torro full feed vs HFB/BTC self-report only.
- `project_joi_payroll.md` — RLS patterns + view-based access control precedents.
- `project_hr_backlog.md` — HR feature status; Feature D (holiday calendar) is still queued after Feature E.
