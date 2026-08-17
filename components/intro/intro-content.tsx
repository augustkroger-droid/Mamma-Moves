"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarCheck2, Dumbbell, Flame, Loader2, Play } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/dates/local-date";
import { summarizeStreak, type StreakPauseRange } from "@/lib/streak/streak";

type TrainingSession = {
  id: string;
  started_at: string;
};

type CompletedExercise = {
  workout_session_id: string;
};

const introVideoUrl = process.env.NEXT_PUBLIC_INTRO_VIDEO_URL;
const bloopersVideoUrl = process.env.NEXT_PUBLIC_BLOOPERS_VIDEO_URL;

export function IntroContent() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [status, setStatus] = useState({
    currentStreak: 0,
    hasTrainedToday: false,
    isPausedToday: false
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatus() {
      const [sessionsResult, pausesResult] = await Promise.all([
        supabase
          .from("workout_sessions")
          .select("id, started_at")
          .in("status", ["completed", "abandoned"]),
        supabase
          .from("streak_pauses")
          .select("start_date, end_date")
      ]);

      if (!sessionsResult.error && !pausesResult.error) {
        const sessionRows = (sessionsResult.data ?? []) as TrainingSession[];
        const sessionIds = sessionRows.map((session) => session.id);
        const completedResult = sessionIds.length > 0
          ? await supabase
              .from("workout_session_exercises")
              .select("workout_session_id")
              .eq("completed", true)
              .in("workout_session_id", sessionIds)
          : { data: [], error: null };

        if (completedResult.error) {
          setIsLoadingStatus(false);
          return;
        }

        const trainedSessionIds = new Set(
          ((completedResult.data ?? []) as CompletedExercise[]).map((exercise) => exercise.workout_session_id)
        );
        const trainedDays = new Set(
          sessionRows
            .filter((session) => trainedSessionIds.has(session.id))
            .map((session) => localDateKey(new Date(session.started_at)))
        );
        const summary = summarizeStreak(trainedDays, (pausesResult.data ?? []) as StreakPauseRange[]);

        setStatus({
          currentStreak: summary.currentStreak,
          hasTrainedToday: summary.hasTrainedToday,
          isPausedToday: summary.isPausedToday
        });
      }

      setIsLoadingStatus(false);
    }

    void loadStatus();
  }, [supabase]);

  async function completeIntro() {
    setIsSaving(true);
    setMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setMessage("Kunde inte hitta inloggad användare.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        has_seen_intro: true,
        intro_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", userData.user.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    router.push("/exercises");
  }

  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Mamma Moves</p>
        <h1 className="page-title">Din alldeles egna träningsapp.</h1>
        <p className="page-lead">
          Välj några övningar, starta ett pass och följ videorna direkt här inne.
        </p>
      </header>

      <section className="surface" style={{ padding: 16 }} aria-label="Introduktionsvideo">
        <div className="video-frame">
          {introVideoUrl ? (
            <video controls playsInline preload="metadata">
              <source src={introVideoUrl} type="video/mp4" />
              Din webbläsare kan inte spela upp videon.
            </video>
          ) : (
            <div className="video-placeholder">
              <div>
                <Play aria-hidden="true" size={38} />
                <p style={{ margin: "10px 0 0", fontWeight: 800 }}>Mamma Moves</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="home-status-grid">
        <article className="card home-status-card">
          <Flame aria-hidden="true" />
          <span>Streak</span>
          <strong>{isLoadingStatus ? "..." : `${status.currentStreak} dagar`}</strong>
        </article>
        <article className="card home-status-card">
          <CalendarCheck2 aria-hidden="true" />
          <span>Idag</span>
          <strong>
            {isLoadingStatus
              ? "..."
              : status.hasTrainedToday
                ? "Tränat"
                : status.isPausedToday
                  ? "Paus"
                  : "Redo"}
          </strong>
        </article>
      </section>

      <section className="card intro-card">
        <h2 className="section-title">Så funkar det</h2>
        <p className="muted">
          Börja i Övningar eller välj ett färdigt pass. När passet startar visar appen en
          video i taget, och du trycker vidare när du är klar.
        </p>
        {message ? <p className="form-message">{message}</p> : null}
        <button className="button full" type="button" onClick={completeIntro} disabled={isSaving}>
          {isSaving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : null}
          Kom igång
          {!isSaving ? <ArrowRight aria-hidden="true" size={20} /> : null}
        </button>
      </section>

      <section className="quick-actions" aria-label="Snabba val">
        <Link className="button secondary full" href="/exercises">
          <Dumbbell aria-hidden="true" size={20} />
          Välj övningar
        </Link>
        <Link className="button secondary full" href="/workouts">
          <CalendarCheck2 aria-hidden="true" size={20} />
          Färdiga pass
        </Link>
      </section>

      {bloopersVideoUrl ? (
        <section className="card bloopers-card" aria-label="Bloopers">
          <div>
            <p className="eyebrow">Bonusklipp</p>
            <h2 className="section-title">Bloopers</h2>
            <p className="muted">Lite skratt från inspelningen, längst ner där det får vara en ren bonus.</p>
          </div>
          <div className="video-frame">
            <video controls playsInline preload="metadata">
              <source src={bloopersVideoUrl} type="video/mp4" />
              Din webbläsare kan inte spela upp videon.
            </video>
          </div>
        </section>
      ) : null}
    </div>
  );
}
