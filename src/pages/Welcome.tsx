import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { DashboardGreeting, dashboardDisplayName } from "@/components/Dashboard/DashboardGreeting";
import { RefreshCw } from "lucide-react";

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export default function Welcome() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", userId)
        .maybeSingle();
      if (!cancelled && data) setProfile(data);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthReady(true);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id);
      } else {
        navigate("/auth", { replace: true });
      }
    });

    void supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (cancelled) return;
      setSession(current);
      setUser(current?.user ?? null);
      setAuthReady(true);
      if (current?.user) {
        void loadProfile(current.user.id);
      } else {
        navigate("/auth", { replace: true });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const enterDashboard = useCallback(() => {
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  if (!authReady || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground/60" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Welcome — NSYNC Journal</title>
      </Helmet>
      <DashboardGreeting name={dashboardDisplayName(profile, user)} onDismiss={enterDashboard} />
    </>
  );
}
