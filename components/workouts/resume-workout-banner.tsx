"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/dates/local-date";

type ResumableSession = {
  id: string;
  started_at: string;
  duration_seconds: number;
  status: "started" | "paused" | "abandoned";
};

function formatMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function ResumeWorkoutBanner() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<ResumableSession | null>(null);

  useEffect(() => {
    async function loadResumableSession() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds, status")
        .in("status", ["started", "paused", "abandoned"])
        .order("started_at", { ascending: false })
        .limit(5);

      if (error) {
        return;
      }

      const today = localDateKey();
      const todaysSession = ((data ?? []) as ResumableSession[]).find(
        (row) => localDateKey(new Date(row.started_at)) === today
      );

      setSession(todaysSession ?? null);
    }

    void loadResumableSession();
  }, [supabase]);

  if (!session) {
    return null;
  }

  return (
    <aside className="resume-banner">
      <div>
        <strong>Pass väntar</strong>
        <span>{formatMinutes(session.duration_seconds)} sparad aktiv tid</span>
      </div>
      <Link className="button secondary" href={`/workout?session=${session.id}`}>
        <Play aria-hidden="true" size={18} />
        Fortsätt
      </Link>
    </aside>
  );
}
