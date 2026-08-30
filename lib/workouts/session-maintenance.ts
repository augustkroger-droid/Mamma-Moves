import { localDateKey } from "@/lib/dates/local-date";
import type { createBrowserSupabaseClient } from "@/lib/supabase/client";

type SupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

type UnfinishedSession = {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  status: "started" | "paused" | "abandoned";
  timer_started_at: string | null;
};

export async function completeOldUnfinishedSessions(supabase: SupabaseClient) {
  const today = localDateKey();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, started_at, completed_at, duration_seconds, status, timer_started_at")
    .in("status", ["started", "paused", "abandoned"]);

  if (error) {
    return;
  }

  const staleSessions = ((data ?? []) as UnfinishedSession[]).filter(
    (session) => localDateKey(new Date(session.started_at)) < today
  );

  await Promise.all(
    staleSessions.map((session) =>
      supabase
        .from("workout_sessions")
        .update({
          status: "completed",
          completed_at: session.completed_at ?? new Date().toISOString(),
          duration_seconds: Math.max(
            1,
            session.duration_seconds + (
              session.status === "started" && session.timer_started_at
                ? Math.max(0, Math.floor((Date.now() - new Date(session.timer_started_at).getTime()) / 1000))
                : 0
            )
          ),
          timer_started_at: null
        })
        .eq("id", session.id)
    )
  );
}
