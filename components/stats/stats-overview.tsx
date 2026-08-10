"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type TrainingSession = {
  id: string;
  started_at: string;
  duration_seconds: number;
};

function dayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function calculateCurrentStreak(days: Set<string>) {
  let streak = 0;
  const cursor = new Date();

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function calculateLongestStreak(days: Set<string>) {
  const sortedDays = [...days].sort();
  let longest = 0;
  let current = 0;
  let previous: Date | null = null;

  for (const key of sortedDays) {
    const date = new Date(`${key}T00:00:00`);
    const isNextDay = previous
      ? Math.round((date.getTime() - previous.getTime()) / 86400000) === 1
      : false;

    current = isNextDay ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = date;
  }

  return longest;
}

export function StatsOverview() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [completedExercises, setCompletedExercises] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      const [sessionsResult, exercisesResult] = await Promise.all([
        supabase
          .from("workout_sessions")
          .select("id, started_at, duration_seconds")
          .neq("status", "started"),
        supabase
          .from("workout_session_exercises")
          .select("id", { count: "exact", head: true })
          .eq("completed", true)
      ]);

      if (sessionsResult.error) {
        setErrorMessage(sessionsResult.error.message);
      } else if (exercisesResult.error) {
        setErrorMessage(exercisesResult.error.message);
      } else {
        setSessions((sessionsResult.data ?? []) as TrainingSession[]);
        setCompletedExercises(exercisesResult.count ?? 0);
      }

      setIsLoading(false);
    }

    void loadStats();
  }, [supabase]);

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Räknar ihop...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="empty-state card" role="alert">
        <h2 className="section-title">Kunde inte hamta statistik</h2>
        <p className="muted">{errorMessage}</p>
      </section>
    );
  }

  const trainedDays = new Set(sessions.map((session) => dayKey(session.started_at)));
  const totalSeconds = sessions.reduce((sum, session) => sum + session.duration_seconds, 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const currentStreak = calculateCurrentStreak(trainedDays);
  const longestStreak = calculateLongestStreak(trainedDays);
  const stats = [
    { label: "Pass", value: sessions.length.toString() },
    { label: "Minuter", value: totalMinutes.toString() },
    { label: "Tranade dagar", value: trainedDays.size.toString() },
    { label: "Ovningar", value: completedExercises.toString() },
    { label: "Streak", value: currentStreak.toString() },
    { label: "Langsta", value: longestStreak.toString() }
  ];

  return (
    <section className="stats-grid">
      {stats.map((stat) => (
        <article key={stat.label} className="card stat-card">
          <p className="muted">{stat.label}</p>
          <p>{stat.value}</p>
        </article>
      ))}
    </section>
  );
}
