import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  user: User | null;
  name: string;
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, name: "", ready: false });

function displayName(user: User | null, profileName?: string | null): string {
  if (!user) return "";
  const meta = user.user_metadata as Record<string, unknown>;
  return (
    profileName ||
    (typeof meta["name"] === "string" ? meta["name"] : "") ||
    (typeof meta["full_name"] === "string" ? meta["full_name"] : "") ||
    (user.email ?? "").split("@")[0] ||
    ""
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, name: "", ready: false });

  useEffect(() => {
    let active = true;
    const load = async (user: User | null) => {
      if (!user) {
        if (active) setState({ user: null, name: "", ready: true });
        return;
      }
      if (active) setState({ user, name: displayName(user), ready: true });
      const { data } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
      if (active && data?.name) setState({ user, name: displayName(user, data.name), ready: true });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      void load(session?.user ?? null);
    });
    void supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
