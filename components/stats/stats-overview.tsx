"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PauseCircle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/dates/local-date";
import {
  pauseDaysFromRanges,
  summarizeStreak,
  type StreakPauseRange
} from "@/lib/streak/streak";

type TrainingSession = {
  id: string;
  started_at: string;
  duration_seconds: number;
};

type CompletedExercise = {
  workout_session_id: string;
};

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const weekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - weekday);
  copy.setHours(0, 0, 0, 0);

  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);

  return copy;
}

function formatWeekLabel(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function getNiceChartMax(minutes: number) {
  if (minutes <= 0) {
    return 30;
  }

  const niceMinuteSteps = [10, 15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 600];
  const predefinedStep = niceMinuteSteps.find((step) => minutes <= step);

  if (predefinedStep) {
    return predefinedStep;
  }

  return Math.ceil(minutes / 300) * 300;
}

function formatAxisMinutes(minutes: number) {
  if (minutes === 0) {
    return "0";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainingMinutes}`;
}

export function StatsOverview() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [pauses, setPauses] = useState<StreakPauseRange[]>([]);
  const [completedExercises, setCompletedExercises] = useState<CompletedExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPausing, setIsPausing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pauseMessage, setPauseMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const [sessionsResult, exercisesResult, pausesResult] = await Promise.all([
      supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds")
        .in("status", ["completed", "abandoned"]),
      supabase
        .from("workout_session_exercises")
        .select("workout_session_id")
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
      setCompletedExercises((exercisesResult.data ?? []) as CompletedExercise[]);
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

  const trainedSessionIds = new Set(completedExercises.map((exercise) => exercise.workout_session_id));
  const trainedDays = new Set(
    sessions
      .filter((session) => trainedSessionIds.has(session.id))
      .map((session) => localDateKey(new Date(session.started_at)))
  );
  const streakSummary = summarizeStreak(trainedDays, pauses);
  const totalSeconds = sessions.reduce((sum, session) => sum + session.duration_seconds, 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const currentWeekStart = startOfWeek(new Date());
  const weeklyBuckets = Array.from({ length: 6 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, (index - 5) * 7);
    const weekEnd = addDays(weekStart, 7);
    const seconds = sessions
      .filter((session) => {
        const startedAt = new Date(session.started_at);
        return startedAt >= weekStart && startedAt < weekEnd;
      })
      .reduce((sum, session) => sum + session.duration_seconds, 0);

    return {
      label: formatWeekLabel(weekStart),
      minutes: Math.round(seconds / 60)
    };
  });
  const maxWeeklyMinutes = Math.max(1, ...weeklyBuckets.map((bucket) => bucket.minutes));
  const chartMaxMinutes = getNiceChartMax(maxWeeklyMinutes);
  const yAxisTicks = [chartMaxMinutes, Math.round(chartMaxMinutes / 2), 0];
  const recentSessions = [...sessions]
    .sort((first, second) => new Date(second.started_at).getTime() - new Date(first.started_at).getTime())
    .slice(0, 4);
  const stats = [
    { label: "Pass", value: sessions.length.toString() },
    { label: "Minuter", value: totalMinutes.toString() },
    { label: "Tränade dagar", value: trainedDays.size.toString() },
    { label: "Övningar", value: completedExercises.length.toString() },
    { label: "Streak", value: streakSummary.currentStreak.toString() },
    { label: "Längsta streak", value: streakSummary.longestStreak.toString() }
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

      <section className="card stats-chart-card">
        <div>
          <h2 className="section-title">Senaste veckorna</h2>
          <p className="muted">Aktiva minuter per vecka.</p>
        </div>
        <div className="week-chart-shell" aria-label="Träning per vecka">
          <div className="week-chart-axis" aria-hidden="true">
            {yAxisTicks.map((tick) => (
              <span key={tick}>{formatAxisMinutes(tick)}</span>
            ))}
          </div>
          <div className="week-chart-area">
            <div className="week-chart-gridlines" aria-hidden="true">
              {yAxisTicks.map((tick) => (
                <span key={tick} />
              ))}
            </div>
            <div className="week-chart">
              {weeklyBuckets.map((bucket) => (
                <div key={bucket.label} className="week-bar">
                  <div className="week-bar__track">
                    <span
                      title={`${bucket.minutes} minuter`}
                      style={{ height: `${Math.max(6, (bucket.minutes / chartMaxMinutes) * 100)}%` }}
                    />
                  </div>
                  <small>{bucket.label}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card recent-sessions-card">
        <h2 className="section-title">Senaste pass</h2>
        {recentSessions.length === 0 ? (
          <p className="muted">Inga pass sparade än.</p>
        ) : (
          <div className="screen-stack">
            {recentSessions.map((session) => (
              <article key={session.id} className="recent-session-row">
                <strong>{new Date(session.started_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}</strong>
                <span>{formatMinutes(session.duration_seconds)}</span>
              </article>
            ))}
          </div>
        )}
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
