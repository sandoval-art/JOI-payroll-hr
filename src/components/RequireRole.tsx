import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Wrappers that handle the loading-before-redirect dance for role-gated routes.
 *
 * Always check `loading` before redirecting on role booleans — without it, the page
 * flashes a redirect on first render before the profile resolves, and the user
 * never reaches the destination.
 *
 * Usage:
 *   <RequireLeadership><Campaigns /></RequireLeadership>
 *   <RequireTeamLeadOrAbove><ShiftSettings /></RequireTeamLeadOrAbove>
 */

interface GuardProps {
  children: ReactNode;
  /** Where to send users who don't have permission. Defaults to "/". */
  redirectTo?: string;
  /** What to render while auth is still loading. Defaults to null. */
  fallback?: ReactNode;
}

export function RequireLeadership({ children, redirectTo = "/", fallback = null }: GuardProps) {
  const { isLeadership, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (!isLeadership) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

export function RequireTeamLeadOrAbove({ children, redirectTo = "/", fallback = null }: GuardProps) {
  const { isLeadership, isTeamLead, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (!isLeadership && !isTeamLead) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

export function RequireOwner({ children, redirectTo = "/", fallback = null }: GuardProps) {
  const { isOwner, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (!isOwner) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}

/** Allows only users with role === 'client'. Non-clients are sent to redirectTo (default "/"). */
export function RequireClient({ children, redirectTo = "/", fallback = null }: GuardProps) {
  const { isClient, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (!isClient) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
