"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Cast, CheckCircle2, Loader2, Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/dates/local-date";
import { summarizeStreak, type StreakPauseRange } from "@/lib/streak/streak";
import {
  clearActiveWorkout,
  readActiveWorkout,
  saveActiveWorkout,
  type ActiveWorkout,
  type WorkoutExercise
} from "@/lib/workouts/active-workout";

type SavedSummary = {
  durationSeconds: number;
  completedCount: number;
  totalCount: number;
  status: "paused" | "completed";
  currentStreak: number;
};

type SessionForStreak = {
  id: string;
  started_at: string;
};

type CompletedExerciseForStreak = {
  workout_session_id: string;
};

type WorkoutSession = {
  id: string;
  workout_template_id: string | null;
  started_at: string;
  duration_seconds: number;
  status: "started" | "paused" | "completed" | "abandoned";
};

type SessionExercise = {
  workout_session_id: string;
  exercise_id: string;
  position: number;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
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

function youtubeWorkoutPlaylistUrl(exercises: WorkoutExercise[]) {
  const videoIds = exercises
    .map((exercise) => exercise.youtube_video_id)
    .filter((videoId): videoId is string => Boolean(videoId))
    .slice(0, 50);

  return videoIds.length > 0 ? `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(",")}` : null;
}

async function loadCurrentStreak(supabase: ReturnType<typeof createBrowserSupabaseClient>) {
  const [sessionsResult, pausesResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("id, started_at")
      .in("status", ["completed", "abandoned"]),
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
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SavedSummary | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const elapsedSecondsRef = useRef(0);
  const isFinishedRef = useRef(false);

  useEffect(() => {
    if (!isVideoFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsVideoFullscreen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVideoFullscreen]);

  useEffect(() => {
    setIsVideoFullscreen(false);
  }, [currentIndex]);

  function toggleVideoFullscreen() {
    setIsVideoFullscreen((current) => !current);
  }

  const persistDuration = useCallback(async (status?: "started" | "paused" | "completed") => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || isFinishedRef.current) {
      return;
    }

    await supabase
      .from("workout_sessions")
      .update({
        duration_seconds: elapsedSecondsRef.current,
        ...(status ? { status } : {})
      })
      .eq("id", sessionId);
  }, [supabase]);

  const createSession = useCallback(async (activeWorkout: ActiveWorkout) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      throw new Error("Kunde inte hitta inloggad användare.");
    }

    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userData.user.id,
        workout_template_id: activeWorkout.workoutTemplateId,
        duration_seconds: 0,
        status: "started"
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      throw new Error(sessionError?.message ?? "Kunde inte starta passet.");
    }

    const rows = activeWorkout.exercises.map((exercise, index) => ({
      workout_session_id: session.id,
      exercise_id: exercise.id,
      position: index + 1,
      completed: false,
      started_at: index === 0 ? new Date().toISOString() : null,
      completed_at: null
    }));

    const { error: rowsError } = await supabase.from("workout_session_exercises").insert(rows);

    if (rowsError) {
      throw new Error(rowsError.message);
    }

    const nextWorkout = {
      ...activeWorkout,
      sessionId: session.id
    };

    saveActiveWorkout(nextWorkout);
    sessionIdRef.current = session.id;
    setSessionExercises(rows);
    return nextWorkout;
  }, [supabase]);

  const loadSession = useCallback(async (sessionId: string) => {
    const { data: session, error: sessionError } = await supabase
      .from("workout_sessions")
      .select("id, workout_template_id, started_at, duration_seconds, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(sessionError?.message ?? "Kunde inte hämta passet.");
    }

    const sessionData = session as WorkoutSession;

    const { data: exerciseLinks, error: linksError } = await supabase
      .from("workout_session_exercises")
      .select("workout_session_id, exercise_id, position, completed, started_at, completed_at")
      .eq("workout_session_id", sessionId)
      .order("position", { ascending: true });

    if (linksError) {
      throw new Error(linksError.message);
    }

    const links = (exerciseLinks ?? []) as SessionExercise[];
    const exerciseIds = links.map((link) => link.exercise_id);
    const { data: exercises, error: exercisesError } = exerciseIds.length > 0
      ? await supabase
          .from("exercises")
          .select("id, name, description, youtube_video_id, thumbnail_url, category, categories")
          .in("id", exerciseIds)
      : { data: [], error: null };

    if (exercisesError) {
      throw new Error(exercisesError.message);
    }

    let title = "Fortsatt pass";

    if (sessionData.workout_template_id) {
      const { data: template } = await supabase
        .from("workout_templates")
        .select("name")
        .eq("id", sessionData.workout_template_id)
        .maybeSingle();

      title = template?.name ?? title;
    }

    const exercisesById = new Map(
      ((exercises ?? []) as WorkoutExercise[]).map((exercise) => [exercise.id, exercise])
    );
    const workoutExercises = links
      .map((link) => exercisesById.get(link.exercise_id))
      .filter((exercise): exercise is WorkoutExercise => Boolean(exercise));
    const nextIndex = Math.max(0, links.findIndex((link) => !link.completed));

    sessionIdRef.current = sessionId;
    elapsedSecondsRef.current = sessionData.duration_seconds;
    setElapsedSeconds(sessionData.duration_seconds);
    setSessionExercises(links);

    return {
      sessionId,
      title,
      workoutTemplateId: sessionData.workout_template_id,
      returnHref: "/calendar",
      exercises: workoutExercises,
      nextIndex: nextIndex === -1 ? Math.max(0, workoutExercises.length - 1) : nextIndex
    };
  }, [supabase]);

  useEffect(() => {
    async function initializeWorkout() {
      try {
        const sessionId = searchParams.get("session");
        if (sessionId) {
          const resumedWorkout = await loadSession(sessionId);
          setWorkout(resumedWorkout);
          setCurrentIndex(resumedWorkout.nextIndex);
          await supabase.from("workout_sessions").update({ status: "started" }).eq("id", sessionId);
          setIsLoading(false);
          return;
        }

        const activeWorkout = readActiveWorkout();

        if (!activeWorkout) {
          setIsLoading(false);
          return;
        }

        if (activeWorkout.sessionId) {
          const resumedWorkout = await loadSession(activeWorkout.sessionId);
          setWorkout(resumedWorkout);
          setCurrentIndex(resumedWorkout.nextIndex);
          setIsLoading(false);
          return;
        }

        const createdWorkout = await createSession(activeWorkout);
        setWorkout(createdWorkout);
        setCurrentIndex(0);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Kunde inte starta passet.");
      } finally {
        setIsLoading(false);
      }
    }

    void initializeWorkout();
  }, [createSession, loadSession, searchParams, supabase]);

  useEffect(() => {
    if (isLoading || summary) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      elapsedSecondsRef.current += 1;
      setElapsedSeconds(elapsedSecondsRef.current);

      if (elapsedSecondsRef.current % 10 === 0) {
        void persistDuration();
      }
    }, 1000);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void persistDuration("paused");
      } else {
        void persistDuration("started");
      }
    }

    function handlePageHide() {
      void persistDuration("paused");
    }

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      void persistDuration("paused");
      window.clearInterval(timer);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isLoading, persistDuration, summary]);

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    const currentExercise = workout?.exercises[currentIndex];

    if (!sessionId || !currentExercise) {
      return;
    }

    const link = sessionExercises.find((exercise) => exercise.exercise_id === currentExercise.id);
    if (!link || link.started_at) {
      return;
    }

    void supabase
      .from("workout_session_exercises")
      .update({ started_at: new Date().toISOString() })
      .eq("workout_session_id", sessionId)
      .eq("exercise_id", currentExercise.id);
  }, [currentIndex, sessionExercises, supabase, workout]);

  async function markExerciseCompleted(index: number) {
    const sessionId = sessionIdRef.current;
    const exercise = workout?.exercises[index];

    if (!sessionId || !exercise) {
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("workout_session_exercises")
      .update({
        completed: true,
        started_at: now,
        completed_at: now
      })
      .eq("workout_session_id", sessionId)
      .eq("exercise_id", exercise.id);

    if (error) {
      throw new Error(error.message);
    }

    setSessionExercises((current) =>
      current.map((row) =>
        row.exercise_id === exercise.id
          ? { ...row, completed: true, started_at: row.started_at ?? now, completed_at: now }
          : row
      )
    );
  }

  async function markExerciseIncomplete(index: number) {
    const sessionId = sessionIdRef.current;
    const exercise = workout?.exercises[index];

    if (!sessionId || !exercise) {
      return;
    }

    const { error } = await supabase
      .from("workout_session_exercises")
      .update({
        completed: false,
        completed_at: null
      })
      .eq("workout_session_id", sessionId)
      .eq("exercise_id", exercise.id);

    if (error) {
      throw new Error(error.message);
    }

    setSessionExercises((current) =>
      current.map((row) =>
        row.exercise_id === exercise.id
          ? { ...row, completed: false, completed_at: null }
          : row
      )
    );
  }

  async function goToPreviousExercise() {
    if (currentIndex === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const previousIndex = currentIndex - 1;
      await markExerciseIncomplete(previousIndex);
      setCurrentIndex(previousIndex);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Kunde inte gå tillbaka till övningen.");
    } finally {
      setIsSaving(false);
    }
  }

  async function finishWorkout(
    status: "paused" | "completed",
    completedCount: number,
    shouldCompleteCurrentExercise = status === "completed"
  ) {
    const sessionId = sessionIdRef.current;

    if (!workout || !sessionId || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      if (status === "completed" && shouldCompleteCurrentExercise) {
        await markExerciseCompleted(currentIndex);
      }

      isFinishedRef.current = status === "completed";
      const completedAt = status === "completed" ? new Date().toISOString() : null;
      const { error } = await supabase
        .from("workout_sessions")
        .update({
          completed_at: completedAt,
          duration_seconds: Math.max(1, elapsedSecondsRef.current),
          status
        })
        .eq("id", sessionId);

      if (error) {
        throw new Error(error.message);
      }

      const currentStreak = status === "completed" ? await loadCurrentStreak(supabase) : 0;

      if (status === "completed") {
        clearActiveWorkout();
      }

      setSummary({
        durationSeconds: Math.max(1, elapsedSecondsRef.current),
        completedCount,
        totalCount: workout.exercises.length,
        status,
        currentStreak
      });
    } catch (error) {
      isFinishedRef.current = false;
      setSaveError(error instanceof Error ? error.message : "Kunde inte spara passet.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main className="workout-shell">
        <section className="empty-state card" aria-live="polite">
          <Loader2 className="spin" aria-hidden="true" />
          <p>Hämtar pass...</p>
        </section>
      </main>
    );
  }

  if (!workout) {
    return (
      <main className="workout-shell">
        <section className="empty-state card">
          <h1 className="section-title">Inget aktivt pass</h1>
          <p className="muted">Välj övningar och skapa ett pass först.</p>
          {saveError ? <p className="form-message">{saveError}</p> : null}
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
          <p className="eyebrow">{summary.status === "completed" ? "Sparat" : "Pausat"}</p>
          <h1>{summary.status === "completed" ? "Bra jobbat!" : "Passet väntar på dig."}</h1>
          <p className="page-lead">
            {formatDuration(summary.durationSeconds)} aktiv träning · {summary.completedCount} av{" "}
            {summary.totalCount} övningar.
          </p>
          {summary.status === "completed" && summary.completedCount > 0 ? (
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
  const completedCount = sessionExercises.filter((exercise) => exercise.completed).length;
  const isLastExercise = currentIndex === workout.exercises.length - 1;
  const youtubeCastHref = youtubeWorkoutPlaylistUrl(workout.exercises);

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

      <section
        className={`video-frame workout-video${isVideoFullscreen ? " workout-video--fill-screen" : ""}`}
        aria-label={currentExercise.name}
      >
        {currentExercise.youtube_video_id ? (
          <>
            <iframe
              key={`${currentExercise.id}-${currentIndex}`}
              src={youtubeEmbedUrl(currentExercise.youtube_video_id)}
              title={currentExercise.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
            />
            <button
              className="video-fullscreen-button"
              type="button"
              onClick={toggleVideoFullscreen}
              aria-label={isVideoFullscreen ? "Stäng helskärm" : "Fyll skärmen"}
              title={isVideoFullscreen ? "Stäng helskärm" : "Fyll skärmen"}
            >
              {isVideoFullscreen ? <Minimize2 aria-hidden="true" size={20} /> : <Maximize2 aria-hidden="true" size={20} />}
            </button>
          </>
        ) : (
          <div className="video-placeholder">
            <p>Den här övningen har ingen video ännu.</p>
          </div>
        )}
      </section>

      <section className="workout-details">
        <div className="workout-meta-row">
          <p className="timer-pill">{formatDuration(elapsedSeconds)}</p>
          {youtubeCastHref ? (
            <a
              className="youtube-cast-link"
              href={youtubeCastHref}
              target="_blank"
              rel="noreferrer"
            >
              <Cast aria-hidden="true" size={17} />
              Casta till YouTube
            </a>
          ) : null}
        </div>
        <h2>{currentExercise.name}</h2>
        {currentExercise.description ? <p className="muted">{currentExercise.description}</p> : null}
        {saveError ? <p className="form-message">{saveError}</p> : null}
      </section>

      <footer className="workout-actions">
        <button
          className="button secondary"
          type="button"
          onClick={() => finishWorkout("paused", completedCount)}
          disabled={isSaving}
        >
          <Pause aria-hidden="true" size={18} />
          Pausa
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={goToPreviousExercise}
          disabled={isSaving || currentIndex === 0}
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Tillbaka
        </button>
        <button
          className="button"
          type="button"
          onClick={async () => {
            try {
              if (isLastExercise) {
                await finishWorkout("completed", workout.exercises.length);
              } else {
                setIsSaving(true);
                await markExerciseCompleted(currentIndex);
                setCurrentIndex((index) => index + 1);
                setIsSaving(false);
              }
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : "Kunde inte spara övningen.");
              setIsSaving(false);
            }
          }}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="spin" aria-hidden="true" size={18} /> : null}
          {isLastExercise ? "Slutför" : "Nästa"}
          {!isLastExercise ? <ArrowRight aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
        </button>
        <button
          className="button secondary workout-end-button"
          type="button"
          onClick={() => finishWorkout("completed", completedCount, false)}
          disabled={isSaving}
        >
          <Square aria-hidden="true" size={18} />
          Avsluta
        </button>
      </footer>
    </main>
  );
}
