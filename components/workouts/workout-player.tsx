"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Square } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/dates/local-date";
import { summarizeStreak, type StreakPauseRange } from "@/lib/streak/streak";
import {
  clearActiveWorkout,
  readActiveWorkout,
  type ActiveWorkout
} from "@/lib/workouts/active-workout";

type SavedSummary = {
  durationSeconds: number;
  completedCount: number;
  totalCount: number;
  status: "completed" | "abandoned";
  currentStreak: number;
};

type SessionForStreak = {
  id: string;
  started_at: string;
};

type CompletedExerciseForStreak = {
  workout_session_id: string;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} sek`;
  }

  return `${minutes} min ${seconds.toString().padStart(2, "0")} sek`;
}

function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}`;
}

async function loadCurrentStreak(supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const [sessionsResult, pausesResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, started_at")
      .neq("status", "started"),
    supabase
      .from("streak_pauses")
      .select("start_date, end_date")
  ]);

  if (sessionsResult.error || pausesResult.error) {
    return 0;
  }

  const sessionRows = (sessionsResult.data ?? []) as SessionForStreak[];
  const sessionIds = sessionRows.map((session) => session.id);
  const completedResult = sessionIds.length > 0
    ? await supabase
        .from("workout_session_exercises")
        .select("workout_session_id")
        .eq("completed", true)
        .in("workout_session_id", sessionIds)
    : { data: [], error: null };

  if (completedResult.error) {
    return 0;
  }

  const trainedSessionIds = new Set(
    ((completedResult.data ?? []) as CompletedExerciseForStreak[]).map((exercise) => exercise.workout_session_id)
  );
  const trainedDays = new Set(
    sessionRows
      .filter((session) => trainedSessionIds.has(session.id))
      .map((session) => localDateKey(new Date(session.started_at)))
  );

  return summarizeStreak(trainedDays, (pausesResult.data ?? []) as StreakPauseRange[]).currentStreak;
}

export function WorkoutPlayer() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const startedAtRef = useRef<Date>(new Date());
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SavedSummary | null>(null);

  useEffect(() => {
    setWorkout(readActiveWorkout());
    startedAtRef.current = new Date();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current.getTime()) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function saveWorkout(status: "completed" | "abandoned", completedCount: number) {
    if (!workout || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const completedAt = new Date();
    const durationSeconds = Math.max(
      1,
      Math.floor((completedAt.getTime() - startedAtRef.current.getTime()) / 1000)
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setSaveError("Kunde inte hitta inloggad användare.");
      setIsSaving(false);
      return;
    }

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userData.user.id,
        workout_template_id: workout.workoutTemplateId,
        started_at: startedAtRef.current.toISOString(),
        completed_at: completedAt.toISOString(),
        duration_seconds: durationSeconds,
        status
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      setSaveError(sessionError?.message ?? "Kunde inte spara passet.");
      setIsSaving(false);
      return;
    }

    const sessionExercises = workout.exercises.map((exercise, index) => ({
      workout_session_id: session.id,
      exercise_id: exercise.id,
      position: index + 1,
      completed: index < completedCount,
      started_at: index < completedCount ? startedAtRef.current.toISOString() : null,
      completed_at: index < completedCount ? completedAt.toISOString() : null
    }));

    const { error: exerciseError } = await supabase
      .from("workout_session_exercises")
      .insert(sessionExercises);

    if (exerciseError) {
      setSaveError(exerciseError.message);
      setIsSaving(false);
      return;
    }

    const currentStreak = await loadCurrentStreak(supabase);

    clearActiveWorkout();
    setSummary({
      durationSeconds,
      completedCount,
      totalCount: workout.exercises.length,
      status,
      currentStreak
    });
    setIsSaving(false);
  }

  if (!workout) {
    return (
      <main className="workout-shell">
        <section className="empty-state card">
          <h1 className="section-title">Inget aktivt pass</h1>
          <p className="muted">Välj övningar och skapa ett pass först.</p>
          <Link className="button" href="/exercises">
            Till övningar
          </Link>
        </section>
      </main>
    );
  }

  if (summary) {
    return (
      <main className="workout-shell">
        <section className="summary-card surface">
          <CheckCircle2 aria-hidden="true" size={46} />
          <p className="eyebrow">Sparat</p>
          <h1>Bra jobbat!</h1>
          <p className="page-lead">
            {formatDuration(summary.durationSeconds)} aktiv träning · {summary.completedCount} av{" "}
            {summary.totalCount} övningar.
          </p>
          {summary.completedCount > 0 ? (
            <p className="streak-callout">{summary.currentStreak} dagars streak</p>
          ) : null}
          <Link className="button full" href="/calendar">
            Se kalendern
          </Link>
          <Link className="button secondary full" href="/exercises">
            Träna mer
          </Link>
        </section>
      </main>
    );
  }

  const currentExercise = workout.exercises[currentIndex];
  const isLastExercise = currentIndex === workout.exercises.length - 1;

  return (
    <main className="workout-shell">
      <header className="workout-header">
        <Link className="icon-button" href={workout.returnHref ?? "/exercises"} title="Tillbaka">
          <ArrowLeft aria-hidden="true" size={20} />
        </Link>
        <div>
          <p className="eyebrow">{workout.title}</p>
          <h1>
            Övning {currentIndex + 1} av {workout.exercises.length}
          </h1>
        </div>
      </header>

      <section className="video-frame workout-video" aria-label={currentExercise.name}>
        <iframe
          key={`${currentExercise.id}-${currentIndex}`}
          src={youtubeEmbedUrl(currentExercise.youtube_video_id)}
          title={currentExercise.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </section>

      <section className="workout-details">
        <p className="timer-pill">{formatDuration(elapsedSeconds)}</p>
        <h2>{currentExercise.name}</h2>
        {currentExercise.description ? <p className="muted">{currentExercise.description}</p> : null}
        {saveError ? <p className="form-message">{saveError}</p> : null}
      </section>

      <footer className="workout-actions">
        <button
          className="button secondary"
          type="button"
          onClick={() => saveWorkout("abandoned", currentIndex)}
          disabled={isSaving}
        >
          <Square aria-hidden="true" size={18} />
          Avsluta
        </button>
        <button
          className="button"
          type="button"
          onClick={() => {
            if (isLastExercise) {
              void saveWorkout("completed", workout.exercises.length);
            } else {
              setCurrentIndex((index) => index + 1);
            }
          }}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="spin" aria-hidden="true" size={18} /> : null}
          {isLastExercise ? "Slutför" : "Nästa"}
          {!isLastExercise ? <ArrowRight aria-hidden="true" size={18} /> : null}
        </button>
      </footer>
    </main>
  );
}
