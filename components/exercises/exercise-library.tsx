"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Loader2, PlusCircle, Shuffle } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { saveActiveWorkout } from "@/lib/workouts/active-workout";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

function youtubeThumbnail(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function shuffleExercises(exercises: Exercise[]) {
  return [...exercises].sort(() => Math.random() - 0.5);
}

export function ExerciseLibrary() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatedWorkout, setGeneratedWorkout] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadExercises() {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setExercises(data ?? []);
      }

      setIsLoading(false);
    }

    void loadExercises();
  }, [supabase]);

  function toggleSelected(exerciseId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
    setGeneratedWorkout([]);
  }

  function createWorkout() {
    const selectedExercises = exercises.filter((exercise) => selectedIds.has(exercise.id));
    setGeneratedWorkout(shuffleExercises(selectedExercises));
  }

  function startWorkout() {
    const workoutExercises = generatedWorkout.length > 0
      ? generatedWorkout
      : shuffleExercises(exercises.filter((exercise) => selectedIds.has(exercise.id)));

    saveActiveWorkout({
      title: "Eget pass",
      workoutTemplateId: null,
      exercises: workoutExercises
    });
    router.push("/workout");
  }

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hamtar ovningar...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="empty-state card" role="alert">
        <h2 className="section-title">Kunde inte hamta ovningar</h2>
        <p className="muted">{errorMessage}</p>
      </section>
    );
  }

  if (exercises.length === 0) {
    return (
      <section className="empty-state card">
        <h2 className="section-title">Inga ovningar an</h2>
        <p className="muted">Kor seed-scriptet eller lagg in ovningar i Supabase sa dyker de upp har.</p>
      </section>
    );
  }

  return (
    <>
      <section className="screen-stack" aria-label="Ovningslista">
        {exercises.map((exercise) => {
          const isSelected = selectedIds.has(exercise.id);
          const thumbnailUrl = exercise.thumbnail_url || youtubeThumbnail(exercise.youtube_video_id);

          return (
            <article key={exercise.id} className={`exercise-card card ${isSelected ? "is-selected" : ""}`}>
              <button type="button" onClick={() => toggleSelected(exercise.id)}>
                <Image src={thumbnailUrl} alt="" width={192} height={120} unoptimized />
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{exercise.category || "Ovning"}</small>
                </span>
                <span className="select-indicator" aria-hidden="true">
                  {isSelected ? <Check size={20} /> : <PlusCircle size={20} />}
                </span>
              </button>
            </article>
          );
        })}
      </section>

      {selectedIds.size > 0 ? (
        <section className="floating-action surface" aria-live="polite">
          <p>
            <strong>{selectedIds.size}</strong> valda
          </p>
          <button className="button" type="button" onClick={createWorkout}>
            <Shuffle aria-hidden="true" size={20} />
            Skapa pass
          </button>
        </section>
      ) : null}

      {generatedWorkout.length > 0 ? (
        <section className="card generated-workout">
          <h2 className="section-title">Dagens ordning</h2>
          <ol>
            {generatedWorkout.map((exercise) => (
              <li key={exercise.id}>{exercise.name}</li>
            ))}
          </ol>
          <button className="button full" type="button" onClick={startWorkout}>
            Starta pass
          </button>
        </section>
      ) : null}
    </>
  );
}
