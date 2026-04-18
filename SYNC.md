# Sync This Repo — CT Instructions

Read this file when D says something like "sync the repo" or "pull latest." Follow the steps in order. Report back at the end; don't chain into other work.

## Goal

Get this machine's local clone of `sandoval-art/JOI-payroll-hr` to match `origin/main`, clean up merged feature branches, and make sure dependencies are current. No dev server, no migrations, no edits — just sync.

## Steps

1. **Locate the repo.** It usually lives at `~/Desktop/JOI Payroll/JOI-payroll-hr`. `cd` there. If the folder does not exist, clone it:

   ```
   mkdir -p ~/Desktop/JOI\ Payroll
   cd ~/Desktop/JOI\ Payroll
   git clone https://github.com/sandoval-art/JOI-payroll-hr.git
   cd JOI-payroll-hr
   ```

2. **Confirm clean working tree.** Run `git status`. If there are any uncommitted changes or untracked files that aren't in `.gitignore`, **stop** and ask D what to do. Do not stash, discard, or commit anything on your own.

3. **Check current branch.** Should be `main`. If not, ask D before switching — he may be mid-feature.

4. **Fetch with prune.**

   ```
   git fetch origin --prune
   ```

5. **Fast-forward main.**

   ```
   git merge --ff-only origin/main
   ```

   If it can't fast-forward, **stop** and tell D why. Do not force, rebase, or merge non-ff without asking.

6. **Clean up merged feature branches.** For each local branch other than `main`, check if its tip commit is reachable from `main` (i.e. fully merged). If yes, delete it with `git branch -d <branch>`. If not fully merged, leave it alone and mention it in the report — do not force-delete.

7. **Install dependencies.**

   ```
   npm install
   ```

   If lockfile warnings or peer-dep conflicts appear, note them in the report.

8. **Check `.env` exists.** If the file is missing, copy from `.env.example` and tell D he needs to fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase dashboard before running the app. Never commit `.env`.

9. **Do not run the dev server.** Sync only.

## Report back

- Current commit hash on `main` (short form, e.g. `2a0b8c8`)
- Last commit message on `main`
- Local branches deleted (or "none")
- Local branches left in place that aren't merged (or "none")
- `npm install` status (clean / warnings / errors)
- Whether `.env` exists

Then tell D: "Sync complete. Next up is Prompt 5b — see the `Next CT prompt` section in `HANDOFF.md`."
