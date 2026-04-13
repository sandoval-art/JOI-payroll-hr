import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface UserProfileData {
  id: string;
  employee_id: string | null;
  role: "admin" | "manager" | "employee";
  created_at: string;
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

  return {
    session,
    user,
    loading: loading || profileLoading,
    signOut,
    // Profile-related returns
    role: profile?.role ?? null,
    employeeId: profile?.employee_id ?? null,
    isAdmin: profile?.role === "admin",
    isManager: profile?.role === "manager",
    isEmployee: profile?.role === "employee",
  };
}
