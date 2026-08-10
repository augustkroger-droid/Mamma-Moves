"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }

      setUser(data.session?.user ?? null);
      setIsLoading(false);
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    void loadSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, pathname, router, user]);

  useEffect(() => {
    async function ensureProfile() {
      if (!user) {
        return;
      }

      const fallbackUsername = user.email?.split("@")[0] ?? "mamma";
      const username = String(user.user_metadata.username || fallbackUsername);

      await supabase.from("profiles").upsert({
        id: user.id,
        username
      });
    }

    void ensureProfile();
  }, [supabase, user]);

  if (isLoading || !user) {
    return (
      <main className="app-shell auth-loading" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar Mamma Moves...</p>
      </main>
    );
  }

  return children;
}
