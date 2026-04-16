# JOI Payroll & HR App — Handoff

Last updated: 2026-04-16

Quick reference for picking the project back up on a new machine.

## ⚠️ BEFORE DEPLOYING TO VERCEL / ANY SERVER — READ THIS

`.env` is no longer tracked by git (untracked and added to `.gitignore`). The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables via `import.meta.env`. See `.env.example` for the required variable names.

**Remaining steps before first deploy:**

1. **Rotate every secret that was previously in `.env`** in the Supabase dashboard (anon key, service role key if present, DB password, any other keys). Assume the old values are compromised since they were committed in git history (first committed in `8eab08a`).
2. **Scrub `.env` from git history** with `git filter-repo` or BFG Repo-Cleaner. Rewriting history requires a force push and coordination if anyone else has a clone.
3. **Put the rotated keys in Vercel's Environment Variables panel** (Project Settings → Environment Variables). Never commit them again.

## Getting set up on a new computer

Clone the repo, install, and run the dev server:

```
git clone https://github.com/sandoval-art/JOI-payroll-hr.git
cd JOI-payroll-hr
npm install
npm run dev
```

The app runs at http://localhost:5173 (or the port Vite picks).

You'll need a `.env` file at the project root with your Supabase keys. Copy `.env.example` and fill in the values from the Supabase dashboard (Project Settings → API):

```
cp .env.example .env
# Then edit .env:
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## Accounts

| Email | Role | Purpose |
|---|---|---|
| diomedes.sandoval@justoutsource.it | Owner | Real login for D (owner-level access) |
| sandoval.028@gmail.com | Agent | Test account to QA the employee experience |
| (Paty's email) | Admin | Paty Rodriguez |
| (Joe's email) | Manager | Joe Renteria — not yet seeded, add via UI |
| (Wendy / Ruben / Javier emails) | Team Lead | Create via UI once they sign up |

## Architecture in 30 seconds

React + TypeScript + Vite + Supabase + TanStack React Query + shadcn/ui + Tailwind.

Route gating is driven by `useAuth()` in `src/hooks/useAuth.tsx`. It reads `user_profiles.role` which is auto-synced from `employees.title` via a Postgres trigger.

Auth state is shared via a React Context (`AuthProvider` wraps the app in `src/App.tsx`). Every component that calls `useAuth()` reads from the same context — no more independent Supabase fetches per component. Profile loading uses a `profileLoadedForId` tracker (not a bare `loading` boolean) to eliminate a race where `loading` was briefly false before the profile fetch started.

**Pattern for any new role-gated page:** wrap the route in a guard from `src/components/RequireRole.tsx`:

```tsx
// In App.tsx
<Route path="/campaigns" element={<RequireLeadership><Campaigns /></RequireLeadership>} />
<Route path="/settings/shifts" element={<RequireTeamLeadOrAbove><ShiftSettings /></RequireTeamLeadOrAbove>} />
<Route path="/owner-only" element={<RequireOwner><OwnerPanel /></RequireOwner>} />
```

Available guards: `RequireLeadership`, `RequireTeamLeadOrAbove`, `RequireOwner`. All three handle the loading-before-redirect dance internally — the page component itself doesn't need to check `loading` for route access. Without the wrapper, the page flashes a redirect on first render before the profile resolves and the user never reaches the destination.

If you still need `loading` inside a page for other reasons (e.g. rendering a skeleton while auth data loads before showing pay info), destructure it from `useAuth()` as normal.

Five-tier title hierarchy (owner → admin → manager → team_lead → agent) is the single source of truth for permissions. Anything `isLeadership` (owner+admin+manager) sees everything including pay. Team leads see team-scoped data without pay. Agents see only their own stuff.

## Permission model

| Permission | Owner | Admin | Manager | Team Lead | Agent |
|---|---|---|---|---|---|
| See payroll / pay info | yes | yes | yes | no | own only |
| Edit shift times | yes | yes | yes | yes (own campaign) | no |
| Approve time off | yes | yes | yes | yes (own team) | request own |
| View team EOD | yes | yes | yes | yes (own team) | own only |
| Clock in / out | yes | yes | yes | yes | yes |

Owner and Admin are functionally identical today. D may spec owner-only powers later.

## Database migrations

Run these in order via the Supabase SQL editor if setting up a fresh database. All files are in `supabase/migrations/`.

1. `20260401165427_*.sql` — initial schema (original Supabase setup)
2. `20260401171237_*.sql` — schema tweaks
3. `20260401230853_*.sql` — more scaffold
4. `20260413000001_full_setup.sql` — consolidated setup (clients, employees, payroll, time_clock, user_profiles, etc.)
5. `20260413000002_seed_employees.sql` — seeds known employees
6. `20260413000003_update_salaries.sql` — salary overrides per D's numbers
7. `20260413120000_timeclock_breaks_and_auto_clockout.sql` — break-aware timeclock columns
8. `20260413120100_auto_clockout_function.sql` — pg_cron auto-clockout every 5 min
9. `20260413130000_shift_seasons.sql` — **no-op** (we decided not to use season toggle)
10. `20260413140000_titles_and_reports_to.sql` — 5-tier title system + reports_to + shift audit log
11. `20260414000001_eod_form_builder.sql` — EOD form builder schema
12. `20260414000002_campaigns_subtitle.sql` — subtitle column on clients (now deprecated)
13. `20260414000003_split_clients_and_campaigns.sql` — **Major refactor**: creates `campaigns` table, migrates `employees.client_id` → `campaign_id`, seeds 4 clients + 12 campaigns, reassigns all employees per roster, redistributes KPIs and shift settings
14. `20260415000001_auto_employee_id_and_holidays.sql` — auto-generated employee IDs (sequence + trigger), mexican_holidays table, payroll_records.overrides_json column
15. `20260417000001_tl_per_campaign.sql` — adds `team_lead_id` to campaigns, cascade triggers for reports_to sync
16. `20260416000001_rls_hardening.sql` — **Security**: replaces all blanket "allow authenticated" RLS policies with role-scoped policies matching the 5-tier permission model. Creates `employees_no_pay` view for team-lead queries. See `docs/security/rls-audit-2026-04-16.md` for the full audit.
17. `20260416000002_rls_hardening_rollback.sql` — **Emergency rollback** for the above. Restores original blanket policies. Only run if something breaks.

One-off fix files (run once, not migrations):
- `supabase/fix_stale_timeclock_row.sql` — preview + delete stray same-minute clock-in/out rows caused by the pre-fix UTC date bug. Run when cleaning up before testing the timeclock on Apr 14, 2026.
- `supabase/fix_owner_and_test_account.sql` — corrects D's test account back to agent and tags the real owner. Run this AFTER creating the diomedes.sandoval@justoutsource.it auth user.
- `supabase/seed_test_employee_daniel.sql` — creates the Daniel Sandoval test employee linked to sandoval.028@gmail.com
- `supabase/seed_shift_settings_defaults.sql` — default shifts for Big Think, HFB, Torro/Scoop
- `supabase/seed_shift_settings_sloc.sql` — SLOC Weekday + Weekend shifts

## What's built

- Authentication with role-based sidebar (three menus: leadership / team_lead / agent)
- Dashboard (leadership)
- Employee management page with Title + Reports To fields on the Add form
- Break-aware timeclock (60min unpaid lunch, 2x 15min paid breaks)
- Auto clock-out at scheduled shift end via pg_cron
- Employee Home page (what agents land on — stat cards, weekly hours chart, Today panel)
- Time Off requests
- Payroll history + invoicing
- Shift Settings admin UI (leadership + team_leads); per-campaign, confirmation prompt on time edits, audit log trigger logging every change
- Minutes Late This Week tracking; clock turns red past grace period
- Modern Trustee design (navy + orange #FFA700, Manrope font)

## What's left

**Next up (in priority order):**

1. **Audit log viewer UI** — small page showing recent shift changes (trigger is already logging to `shift_settings_audit`). ~30min of work.
2. **Late notification digest** — batch email to team leads every 15 min listing agents past grace. Needs Resend or similar email setup.
3. **Team Coverage report** — summary of who's working which campaign per day.
4. **Modern Trustee polish** — Dashboard final pass, Auth editorial card, final QA (Tasks 9/10/11 from Modern Trustee design plan).
5. **Delete `src/pages/EODFormBuilder.tsx`** — stubbed with a throw on 2026-04-14 so the file is safe to remove from the repo. Builder functionality now lives on the Campaigns page.

**TL-per-campaign + required email (2026-04-17):**
- **`campaigns.team_lead_id`** — TL is a property of the campaign, not the employee. DB triggers auto-sync `employees.reports_to` when campaign_id or team_lead_id changes. No manual `reports_to` writes in app code.
- **CampaignDetail** — TL dropdown in campaign header. Saving cascades `reports_to` to all agents on that campaign. Toast shows count.
- **Add Employee form** — email required, Reports To dropdown removed (auto-derived). Edge function `create-employee` handles atomic auth user + employee + user_profiles creation with invite email.
- **EmpleadoPerfil** — supervisor shown read-only (derived from campaign TL).
- **ShiftSettings** — TLs now scoped to their own campaigns only.
- **TL Home time-off cards** — fixed Invalid Date + missing employee names.
- **Attendance tabs** — scoped to campaigns (not titles), TLs see only their campaigns.
- **Migration:** `20260417000001_tl_per_campaign.sql` — team_lead_id column, sync triggers, backfill 5 known TLs, email column on employees.
- **Nelly** needs an email + invite — manual step for D (no email was assigned).
- **Employees still with NULL reports_to**: only those on campaigns without a TL set (Data Entry, Decline, Designer, SEO Specialist, Sales CS, Tech Support, Underwriting). D can set TLs via CampaignDetail UI.

**TL Dashboard (2026-04-16):**
- **TeamLeadHome page** (`src/pages/TeamLeadHome.tsx`) — proper home screen for Team Leads, replacing the `/asistencia` redirect stopgap.
- 4 cards: Today's Attendance (live clock-in status per team member), Pending Time Off (approve/deny), EOD Performance This Week (metric aggregation with top/bottom badges), Underperformer Alerts (missed EOD + frequent lates).
- 5 hooks in `src/hooks/useTeamLead.ts`: `useTeamRoster`, `useTodayTimeclockStatus`, `usePendingTimeOffForTeam`, `useTeamEODThisWeek`, `useUnderperformerAlerts`. All filter by `reports_to` for defense in depth.
- Approve/Deny writes `status`, `reviewed_by`, `reviewed_at` to `time_off_requests`.
- Zero pay fields — verified by grep.
- `RoleHome` now routes: leadership → Dashboard, team_lead → TeamLeadHome, agent → EmployeeHome.
- Shift defaults already Mon-Fri in both CampaignDetail and ShiftSettings. No campaigns with all-7-day shifts found.

**Campaign owns shift (2026-04-16):**
- **Shift is a campaign property, not an employee property.** One campaign = one shift pattern. `shift_settings` table is the single source of truth. `employees.shift_type` is ignored by the app (column left in DB for rollback safety, will be dropped in a follow-up).
- Removed all reads/writes of `employees.shift_type` from: `useSupabasePayroll.ts` (mapEmployee, add/update/bulk mutations, history records), `Empleados.tsx` (form + table), `EmpleadoPerfil.tsx` (header), `EmployeeHome.tsx` (display), `useInvoices.ts` (agent query).
- Removed `Turno` type from `payroll.ts` and all consumers.
- `CampaignDetail.tsx` rewritten as full campaign admin screen: campaign info editing, shift settings editing (days + times + grace), KPI/EOD metrics management, assigned agents roster with remove, and assign-existing-employee dropdown.
- `usePayrollComputed.ts` already reads shift from `shift_settings.days_of_week` — no change needed.

**Bug sweep (2026-04-15):**
- **Bug 1 — TL attendance scoping:** Attendance.tsx now filters employees by `reports_to` for TLs. Leadership sees all. Nelly Sandoval seeded as reporting to sandoval801 test TL.
- **Bug 2 — TL salary leak on homepage:** `RoleHome` now routes TLs to `/asistencia` instead of Dashboard. TLs never hit the salary-exposing Dashboard.
- **Bug 3 — Shift dropdown mismatch:** EmpleadoPerfil shift dropdown was binding frontend Turno values against shift_settings names. Replaced with read-only campaign shift display.
- **Bug 4 — mapEmployee missing title/reportsTo:** `mapEmployee` in useSupabasePayroll.ts wasn't mapping `title` or `reports_to` from DB rows, breaking supervisor dropdown and title-based filtering.
- **Bug 5 — Route guards:** Added `<RequireLeadership>` to `/empleados`, `/historial`, `/facturas*`. Added `<RequireTeamLeadOrAbove>` to `/empleados/:id`, `/asistencia`, `/desempeno`. Agents can only access `/`, `/reloj`, `/eod`, `/solicitudes`, `/account`.

**Recently shipped (2026-04-15):**
- **Auto-generated employee IDs.** DB sequence + trigger (`trg_assign_employee_id`) auto-assigns `JOI-XXXX` format IDs on insert. Manual ID field stripped from Add Employee form. Migration: `20260415000001_auto_employee_id_and_holidays.sql`.
- **ClientCampaignPicker shared component** (`src/components/ClientCampaignPicker.tsx`). Cascading Client → Campaign dropdowns. Used in both Add Employee form and EmpleadoPerfil.
- **Add Employee form** now includes Client/Campaign assignment via the picker. Auto-generated ID shown in success toast.
- **Biweekly Adjustments card removed** from EmpleadoPerfil. Per-period adjustments (KPI, bonuses) now live on the Payroll Run screen. Profile keeps read-only Biweekly Breakdown.
- **`usePayrollComputed` hook** (`src/hooks/usePayrollComputed.ts`). Auto-derives days absent, sunday premium, holiday days worked, extra days worked from `time_clock` + `shift_settings` + `mexican_holidays` + approved `time_off_requests`.
- **Payroll Run page** (`/payroll-run`, leadership-only). Per-employee table with auto-computed columns (overridable via pencil popovers), manual KPI checkbox + bonus input, live net pay calculation. Saves to `payroll_records` with `overrides_json` tracking which fields were manually overridden.
- **Mexican holidays table** seeded with 2026 dates. `payroll_records.overrides_json` column added.

**Recently shipped (2026-04-14, schema refactor):**
- **Schema: clients vs campaigns split.** `clients` is now the billing entity (Torro, BTC, Scoop, HFB). `campaigns` is a child table (SLOC Weekday, MCA, Transfers, etc.). `employees.client_id` was renamed to `campaign_id` → FK to `campaigns(id)`. `invoices.client_id` stays on `clients(id)`. Migration: `20260414000003_split_clients_and_campaigns.sql`.
- Campaigns page rewritten as two-level: Client cards → expand to see campaigns. Full CRUD on both.
- CampaignDetail breadcrumb shows `Client › Campaign`.
- EmpleadoPerfil: cascading Client → Campaign dropdowns. Salary card gated on `isLeadership` (hidden from Team Leads).
- All employees mapped to correct campaigns per roster PDF. 7 inactive employees deactivated. 4 work-name renames applied (Jacob Miller, Hannia Lopez, Sofia Gonzalez, Mauro Gomez). 5 Team Leads confirmed.
- KPI config redistributed per campaign (credit-puller metrics on both SLOC campaigns, MCA/Sales Agent/Sales CS metrics split from parent).
- Shift settings reseeded for all 12 campaigns.

**Also shipped (2026-04-14):**
- EOD clock-out gate: agents can't clock out until they answer their campaign's KPI fields. The dialog lives in `src/components/ClockOutEODDialog.tsx` and is triggered from `Timeclock.tsx`. If a campaign has no active KPI fields configured, clock-out proceeds silently (no form).
- EOD Form Builder page removed — per-campaign KPI config is now on the Campaigns → [Campaign] page.
- `My EOD` sidebar item renamed to `My EOD History` and the page rewritten as a read-only list of the agent's past submissions.

## Key files to know

- `src/hooks/useAuth.tsx` — `AuthProvider` + `useAuth()` context. Title + permission booleans (`isLeadership`, `isTeamLead`, `isAgent`, strict matches like `isOwner`), plus `loading` flag for gating redirects
- `src/App.tsx` — wraps the tree in `<AuthProvider>` so all components share auth state
- `src/components/RequireRole.tsx` — `<RequireLeadership>`, `<RequireTeamLeadOrAbove>`, `<RequireOwner>` route wrappers that handle the loading guard automatically
- `src/components/AppSidebar.tsx` — three menus per title tier
- `src/pages/EmployeeHome.tsx` — what agents see on login
- `src/pages/Timeclock.tsx` — break-aware clock-in/out, red clock past grace
- `src/pages/ShiftSettings.tsx` — per-campaign shift hours; team_lead scoped to own campaign
- `src/pages/Empleados.tsx` — employee list + Add form (with Title + Reports To)
- `src/App.tsx` — routing + `RoleHome` wrapper
- `src/components/ClockOutEODDialog.tsx` — pre-clock-out EOD form; renders KPI fields per campaign and blocks clock-out until submitted
- `supabase/migrations/20260413140000_titles_and_reports_to.sql` — reference for the title model

## Development commands

```
npm run dev          # start dev server
npm run build        # production build
npm run lint         # eslint
npm run test         # vitest once
npm run test:watch   # vitest watch mode
npx tsc --noEmit     # type-check without emitting
```

## Known gotchas

- Supabase MCP may point at the wrong project (the-living-word rather than JOI). Prefer writing SQL migration files for the user to run manually until this is fixed.
- `.git/index.lock` can get stuck if a terminal is closed mid-commit. Fix: `rm -f .git/index.lock`.
- The `employees` table has `campaign_id` (FK to `campaigns`). The `clients` table is the billing parent. A client like Torro has multiple campaigns (SLOC Weekday, MCA, etc.). Invoices roll up at the client level; agents are assigned at the campaign level.
- shadcn Table uses `<TableHeader>` as the `<thead>` wrapper and `<TableHead>` as the `<th>` cell. Easy to swap by accident.
- `user_profiles.role` is auto-synced from `employees.title` by a trigger (`trg_sync_user_profile_role`). Don't write to `role` directly — update `title` and let the trigger handle it.
- Role-gated pages MUST use the `<RequireLeadership>` / `<RequireTeamLeadOrAbove>` / `<RequireOwner>` wrappers from `src/components/RequireRole.tsx`. Don't inline-guard with `<Navigate>` — the wrapper handles the loading race; rolling your own leads to the "flash redirect before profile loads" bug.
- **Never use `new Date().toISOString().split("T")[0]` for the `date` column of `time_clock` or `eod_logs`.** That's UTC date. For an agent in Mexico (UTC-6) clocking in at 6 PM local, UTC is already the next day — so the row gets stamped with tomorrow's date and breaks today's queries. Use `todayLocal()` from `src/lib/localDate.ts`. For display, use `parseLocalDate(dateStr)` so `2026-04-14` doesn't render as Apr 13 via UTC-midnight parsing.
