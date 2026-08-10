"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PauseCircle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/dates/local-date";
import {
  calculateCurrentStreak,
  calculateLongestStreak,
  pauseDaysFromRanges,
  type StreakPauseRange
} from "@/lib/streak/streak";

type TrainingSession = {
  id: string;
  started_at: string;
  duration_seconds: number;
};

export function StatsOverview() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [pauses, setPauses] = useState<StreakPauseRange[]>([]);
  const [completedExercises, setCompletedExercises] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPausing, setIsPausing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const [sessionsResult, exercisesResult, pausesResult] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds")
        .neq("status", "started"),
      supabase
        .from("workout_session_exercises")
        .select("id", { count: "exact", head: true })
        .eq("completed", true),
      supabase
        .from("streak_pauses")
        .select("start_date, end_date")
    ]);

    if (sessionsResult.error) {
      setErrorMessage(sessionsResult.error.message);
    } else if (exercisesResult.error) {
      setErrorMessage(exercisesResult.error.message);
    } else if (pausesResult.error) {
      setErrorMessage(pausesResult.error.message);
    } else {
      setSessions((sessionsResult.data ?? []) as TrainingSession[]);
      setCompletedExercises(exercisesResult.count ?? 0);
      setPauses((pausesResult.data ?? []) as StreakPauseRange[]);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  async function pauseToday() {
    const today = localDateKey();
    const pausedDays = pauseDaysFromRanges(pauses);

    if (pausedDays.has(today)) {
      setPauseMessage("Streaken är redan pausad idag.");
      return;
    }

    setIsPausing(true);
    setPauseMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setPauseMessage("Kunde inte hitta inloggad användare.");
      setIsPausing(false);
      return;
    }

    const { error } = await supabase.from("streak_pauses").insert({
      user_id: userData.user.id,
      start_date: today,
      end_date: today
    });

    if (error) {
      setPauseMessage(error.message);
    } else {
      setPauseMessage("Streaken är pausad för idag.");
      await loadStats();
    }

    setIsPausing(false);
  }

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
        <h2 className="section-title">Kunde inte hämta statistik</h2>
        <p className="muted">{errorMessage}</p>
      </section>
    );
  }

  const trainedDays = new Set(sessions.map((session) => localDateKey(new Date(session.started_at))));
  const pausedDays = pauseDaysFromRanges(pauses);
  const totalSeconds = sessions.reduce((sum, session) => sum + session.duration_seconds, 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const currentStreak = calculateCurrentStreak(trainedDays, pausedDays);
  const longestStreak = calculateLongestStreak(trainedDays, pausedDays);
  const stats = [
    { label: "Pass", value: sessions.length.toString() },
    { label: "Minuter", value: totalMinutes.toString() },
    { label: "Tränade dagar", value: trainedDays.size.toString() },
    { label: "Övningar", value: completedExercises.toString() },
    { label: "Streak", value: currentStreak.toString() },
    { label: "Längsta", value: longestStreak.toString() }
  ];

  return (
    <>
      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="card stat-card">
            <p className="muted">{stat.label}</p>
            <p>{stat.value}</p>
          </article>
        ))}
      </section>

      <section className="card pause-card">
        <div>
          <h2 className="section-title">Behöver du vila?</h2>
          <p className="muted">Pausa streaken för idag utan att tappa flytet.</p>
        </div>
        {pauseMessage ? <p className="form-message">{pauseMessage}</p> : null}
        <button className="button secondary full" type="button" onClick={pauseToday} disabled={isPausing}>
          {isPausing ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <PauseCircle aria-hidden="true" size={20} />}
          Pausa idag
        </button>
      </section>
    </>
  );
}
