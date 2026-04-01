

# Add Authentication + Remove Anon Policies

## Summary
Implement email/password authentication to secure the payroll system, then remove the permissive `anon` RLS policies so only authenticated users can access data.

## Step 1: Create Auth Pages
- **Login page** (`src/pages/Auth.tsx`): Email/password sign-in and sign-up form using `supabase.auth.signInWithPassword` and `supabase.auth.signUp`. Spanish-language UI matching the existing blue/gray theme.
- **Password reset page** (`src/pages/ResetPassword.tsx`): Form to set a new password after clicking the reset link.

## Step 2: Auth Context & Route Protection
- Create `src/hooks/useAuth.tsx` with `onAuthStateChange` listener + `getSession` to track auth state.
- Wrap the app in an auth guard: if not authenticated, redirect to `/auth`. All existing routes (`/`, `/empleados`, `/historial`) become protected.
- Add a logout button to the sidebar.

## Step 3: Database Migration — Remove Anon Policies
Run a migration to drop the 3 `anon` policies:

```sql
DROP POLICY "Anon access to employees" ON public.employees;
DROP POLICY "Anon access to payroll_periods" ON public.payroll_periods;
DROP POLICY "Anon access to payroll_records" ON public.payroll_records;
```

This resolves both security findings: the exposed sensitive data error and the overly permissive RLS warning.

## Step 4: Update App Router
- Add `/auth` and `/reset-password` routes (public, outside `AppLayout`).
- Redirect unauthenticated users to `/auth`.

## Technical Details
- Uses Supabase's built-in `auth.users` — no profiles table needed (no user-specific data beyond login).
- The existing `authenticated` RLS policies remain unchanged and will work once users sign in.
- `emailRedirectTo: window.location.origin` for signup confirmation; `redirectTo: window.location.origin + '/reset-password'` for password reset.

