"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isLoading, setIsLoading] = useState(false);

  async function signOut() {
    setIsLoading(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <button className="icon-button" type="button" onClick={signOut} disabled={isLoading} title="Logga ut">
      <LogOut aria-hidden="true" size={20} />
    </button>
  );
}
