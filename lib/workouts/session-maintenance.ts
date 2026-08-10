import { localDateKey } from "@/lib/dates/local-date";
import type { createBrowserSupabaseClient } from "@/lib/supabase/client";

type SupabaseClient = ReturnType<typeof createBrowserSupabaseClient>;

type UnfinishedSession = {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  status: "started" | "paused" | "abandoned";
};

export async function completeOldUnfinishedSessions(supabase: SupabaseClient) {
  const today = localDateKey();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, started_at, completed_at, duration_seconds, status")
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
          duration_seconds: Math.max(1, session.duration_seconds)
        })
        .eq("id", session.id)
    )
  );
}
