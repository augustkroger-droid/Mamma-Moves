"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { eachDateInRange, localDateKey } from "@/lib/dates/local-date";

type TrainingSession = {
  id: string;
  started_at: string;
  duration_seconds: number;
  status: "started" | "completed" | "abandoned";
};

type SessionExercise = {
  workout_session_id: string;
  exercise_id: string;
  position: number;
  completed: boolean;
};

type Exercise = {
  id: string;
  name: string;
};

type StreakPause = {
  start_date: string;
  end_date: string;
};

function formatMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function TrainingCalendar() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [exercisesById, setExercisesById] = useState<Map<string, Exercise>>(new Map());
  const [pauses, setPauses] = useState<StreakPause[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(localDateKey());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      const { data: sessionRows, error: sessionError } = await supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds, status")
        .neq("status", "started")
        .order("started_at", { ascending: false });

      if (sessionError) {
        setErrorMessage(sessionError.message);
        setIsLoading(false);
        return;
      }

      const sessionsData = (sessionRows ?? []) as TrainingSession[];
      const sessionIds = sessionsData.map((session) => session.id);
      const [pauseResult, sessionExercisesResult] = await Promise.all([
        supabase.from("streak_pauses").select("start_date, end_date"),
        sessionIds.length > 0
          ? supabase
              .from("workout_session_exercises")
              .select("workout_session_id, exercise_id, position, completed")
              .in("workout_session_id", sessionIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (pauseResult.error) {
        setErrorMessage(pauseResult.error.message);
        setIsLoading(false);
        return;
      }

      if (sessionExercisesResult.error) {
        setErrorMessage(sessionExercisesResult.error.message);
        setIsLoading(false);
        return;
      }

      const sessionExercisesData = (sessionExercisesResult.data ?? []) as SessionExercise[];
      const exerciseIds = [...new Set(sessionExercisesData.map((exercise) => exercise.exercise_id))];
      const exerciseResult = exerciseIds.length > 0
        ? await supabase.from("exercises").select("id, name").in("id", exerciseIds)
        : { data: [], error: null };

      if (exerciseResult.error) {
        setErrorMessage(exerciseResult.error.message);
        setIsLoading(false);
        return;
      }

      setSessions(sessionsData);
      setSessionExercises(sessionExercisesData);
      setExercisesById(new Map(((exerciseResult.data ?? []) as Exercise[]).map((exercise) => [exercise.id, exercise])));
      setPauses((pauseResult.data ?? []) as StreakPause[]);
      setIsLoading(false);
    }

    void loadSessions();
  }, [supabase]);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
  const sessionsByDay = new Map<string, TrainingSession[]>();
  const pausedDays = new Set(pauses.flatMap((pause) => eachDateInRange(pause.start_date, pause.end_date)));

  for (const session of sessions) {
    const key = localDateKey(new Date(session.started_at));
    sessionsByDay.set(key, [...(sessionsByDay.get(key) ?? []), session]);
  }

  const selectedSessions = sessionsByDay.get(selectedDay) ?? [];
  const selectedIsPaused = pausedDays.has(selectedDay);

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar kalender...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="empty-state card" role="alert">
        <h2 className="section-title">Kunde inte hämta kalendern</h2>
        <p className="muted">{errorMessage}</p>
      </section>
    );
  }

  return (
    <>
      <section className="surface calendar-panel" aria-label="Månadskalender">
        <div className="calendar-grid calendar-weekdays" aria-hidden="true">
          {["M", "T", "O", "T", "F", "L", "S"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {monthDays.map((day) => {
            const key = localDateKey(day);
            const hasTraining = sessionsByDay.has(key);
            const hasPause = pausedDays.has(key);
            const isSelected = selectedDay === key;

            return (
              <button
                key={key}
                type="button"
                className={`${hasTraining ? "has-training" : ""} ${hasPause ? "has-pause" : ""}`}
                aria-pressed={isSelected}
                onClick={() => setSelectedDay(key)}
              >
                <strong>{day.getDate()}</strong>
                {hasTraining ? <small>Tränat</small> : null}
                {!hasTraining && hasPause ? <small>Paus</small> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card day-details">
        <h2 className="section-title">{selectedDay}</h2>
        {selectedSessions.length === 0 && !selectedIsPaused ? (
          <p className="muted">Ingen träning sparad den här dagen.</p>
        ) : (
          <div className="screen-stack">
            {selectedIsPaused ? (
              <article className="session-row is-pause">
                <strong>Pausad streak</strong>
                <span>Vila</span>
              </article>
            ) : null}
            {selectedSessions.map((session) => (
              <article key={session.id} className="session-detail">
                <div className="session-row">
                  <strong>{session.status === "completed" ? "Genomfört pass" : "Avslutat pass"}</strong>
                  <span>{formatMinutes(session.duration_seconds)}</span>
                </div>
                <ul>
                  {sessionExercises
                    .filter((exercise) => exercise.workout_session_id === session.id)
                    .sort((first, second) => first.position - second.position)
                    .map((exercise) => (
                      <li key={exercise.exercise_id}>
                        {exercisesById.get(exercise.exercise_id)?.name ?? "Övning"}
                        {exercise.completed ? "" : " (ej klar)"}
                      </li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
