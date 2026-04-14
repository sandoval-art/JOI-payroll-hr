import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserTitle = "owner" | "admin" | "manager" | "team_lead" | "agent";

interface UserProfileData {
  id: string;
  employee_id: string | null;
  // role mirrors employees.title (kept in sync by trigger). May still hold
  // legacy values like 'employee' until the migration runs.
  role: UserTitle | "employee" | null;
  created_at: string;
}

// Map any legacy/unknown role value to the new title enum
function normalizeTitle(role: string | null | undefined): UserTitle {
  if (role === "employee") return "agent";
  if (
    role === "owner" ||
    role === "admin" ||
    role === "manager" ||
    role === "team_lead" ||
    role === "agent"
  ) {
    return role;
  }
  return "agent";
}

// Display label for a title
export function titleLabel(t: UserTitle): string {
  switch (t) {
    case "owner": return "Owner";
    case "admin": return "Admin";
    case "manager": return "Manager";
    case "team_lead": return "Team Lead";
    case "agent": return "Agent";
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Fetch user profile when user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          // If profile doesn't exist, that's fine - just set null
          if (error.code !== "PGRST116") {
            console.error("Error fetching user profile:", error);
          }
          setProfile(null);
        } else {
          setProfile(data as UserProfileData);
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const title: UserTitle | null = profile ? normalizeTitle(profile.role) : null;

  // Leadership = owner + admin + manager. They see everything (including pay).
  const isLeadership = title === "owner" || title === "admin" || title === "manager";

  return {
    session,
    user,
    loading: loading || profileLoading,
    signOut,
    // Title (single source of truth)
    title,
    role: title, // alias for back-compat
    employeeId: profile?.employee_id ?? null,
    // Strict title checks
    isOwner: title === "owner",
    isAdmin: title === "admin",
    isManager: title === "manager",
    isTeamLead: title === "team_lead",
    isAgent: title === "agent",
    // Permission tiers (use these for gates)
    isLeadership,
    // Back-compat alias — old code reads isEmployee to mean "regular worker"
    isEmployee: title === "agent",
  };
}
