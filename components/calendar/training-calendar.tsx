"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type TrainingSession = {
  id: string;
  started_at: string;
  duration_seconds: number;
  status: "started" | "completed" | "abandoned";
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMinutes(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function TrainingCalendar() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(dateKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id, started_at, duration_seconds, status")
        .neq("status", "started")
        .order("started_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSessions((data ?? []) as TrainingSession[]);
      }

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

  for (const session of sessions) {
    const key = dateKey(new Date(session.started_at));
    sessionsByDay.set(key, [...(sessionsByDay.get(key) ?? []), session]);
  }

  const selectedSessions = sessionsByDay.get(selectedDay) ?? [];

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hamtar kalender...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="empty-state card" role="alert">
        <h2 className="section-title">Kunde inte hamta kalendern</h2>
        <p className="muted">{errorMessage}</p>
      </section>
    );
  }

  return (
    <>
      <section className="surface calendar-panel" aria-label="Manadskalender">
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
            const key = dateKey(day);
            const hasTraining = sessionsByDay.has(key);
            const isSelected = selectedDay === key;

            return (
              <button
                key={key}
                type="button"
                className={hasTraining ? "has-training" : ""}
                aria-pressed={isSelected}
                onClick={() => setSelectedDay(key)}
              >
                <strong>{day.getDate()}</strong>
                {hasTraining ? <small>Tranat</small> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card day-details">
        <h2 className="section-title">{selectedDay}</h2>
        {selectedSessions.length === 0 ? (
          <p className="muted">Ingen traning sparad den har dagen.</p>
        ) : (
          <div className="screen-stack">
            {selectedSessions.map((session) => (
              <article key={session.id} className="session-row">
                <strong>{session.status === "completed" ? "Genomfort pass" : "Avslutat pass"}</strong>
                <span>{formatMinutes(session.duration_seconds)}</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
