"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus, Play, X } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { saveActiveWorkout, type WorkoutExercise } from "@/lib/workouts/active-workout";
import type { Database } from "@/types/database";

type WorkoutTemplate = Database["public"]["Tables"]["workout_templates"]["Row"];
type TemplateExercise = Database["public"]["Tables"]["workout_template_exercises"]["Row"];
type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

function youtubeThumbnail(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function WorkoutTemplateDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplate() {
      const templateId = params.id;
      const [templateResult, linksResult, exercisesResult] = await Promise.all([
        supabase.from("workout_templates").select("*").eq("id", templateId).single(),
        supabase
          .from("workout_template_exercises")
          .select("workout_template_id, exercise_id, position")
          .eq("workout_template_id", templateId)
          .order("position", { ascending: true }),
        supabase
          .from("exercises")
          .select("*")
          .eq("active", true)
          .order("name", { ascending: true })
      ]);

      if (templateResult.error) {
        setErrorMessage(templateResult.error.message);
      } else if (linksResult.error) {
        setErrorMessage(linksResult.error.message);
      } else if (exercisesResult.error) {
        setErrorMessage(exercisesResult.error.message);
      } else {
        const exerciseRows = (exercisesResult.data ?? []) as Exercise[];
        const exercisesById = new Map(exerciseRows.map((exercise) => [exercise.id, exercise]));

        setTemplate(templateResult.data as WorkoutTemplate);
        setAllExercises(exerciseRows);
        setSelectedExercises(
          ((linksResult.data ?? []) as TemplateExercise[])
            .map((link) => exercisesById.get(link.exercise_id))
            .filter((exercise): exercise is Exercise => Boolean(exercise))
        );
      }

      setIsLoading(false);
    }

    void loadTemplate();
  }, [params.id, supabase]);

  function removeExercise(exerciseId: string) {
    setSelectedExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
  }

  function addExercise(exercise: Exercise) {
    setSelectedExercises((current) => [...current, exercise]);
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedExercises.length) {
      return;
    }

    setSelectedExercises((current) => moveItem(current, index, nextIndex));
  }

  function startWorkout() {
    if (!template || selectedExercises.length === 0) {
      return;
    }

    saveActiveWorkout({
      title: template.name,
      workoutTemplateId: template.id,
      returnHref: `/workouts/${template.id}`,
      exercises: selectedExercises
    });
    router.push("/workout");
  }

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar pass...</p>
      </section>
    );
  }

  if (errorMessage || !template) {
    return (
      <section className="empty-state card" role="alert">
        <h1 className="section-title">Kunde inte hämta passet</h1>
        <p className="muted">{errorMessage ?? "Passet finns inte."}</p>
        <Link className="button" href="/workouts">Till pass</Link>
      </section>
    );
  }

  const selectedIds = new Set(selectedExercises.map((exercise) => exercise.id));
  const availableExercises = allExercises.filter((exercise) => !selectedIds.has(exercise.id));

  return (
    <div className="screen-stack">
      <Link className="back-link" href="/workouts">
        <ArrowLeft aria-hidden="true" size={18} />
        Pass
      </Link>

      <header>
        <p className="eyebrow">{template.category || "Pass"}</p>
        <h1 className="page-title">{template.name}</h1>
        {template.description ? <p className="page-lead">{template.description}</p> : null}
      </header>

      <section className="card workout-editor-panel">
        <h2 className="section-title">Övningar i passet</h2>
        {selectedExercises.length === 0 ? (
          <p className="muted">Välj minst en övning för att kunna starta passet.</p>
        ) : (
          <div className="editable-exercise-list">
            {selectedExercises.map((exercise, index) => (
              <article key={exercise.id} className="editable-exercise-row">
                <Image
                  src={exercise.thumbnail_url || youtubeThumbnail(exercise.youtube_video_id)}
                  alt=""
                  width={128}
                  height={80}
                  unoptimized
                />
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{exercise.category || "Övning"}</small>
                </span>
                <div className="row-actions">
                  <button type="button" onClick={() => moveExercise(index, -1)} disabled={index === 0} title="Flytta upp">
                    <ArrowUp aria-hidden="true" size={18} />
                  </button>
                  <button type="button" onClick={() => moveExercise(index, 1)} disabled={index === selectedExercises.length - 1} title="Flytta ner">
                    <ArrowDown aria-hidden="true" size={18} />
                  </button>
                  <button type="button" onClick={() => removeExercise(exercise.id)} title="Ta bort">
                    <X aria-hidden="true" size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <button className="button full" type="button" onClick={startWorkout} disabled={selectedExercises.length === 0}>
          <Play aria-hidden="true" size={20} />
          Starta pass
        </button>
      </section>

      <section className="card workout-editor-panel">
        <h2 className="section-title">Lägg till övningar</h2>
        {availableExercises.length === 0 ? (
          <p className="muted">Alla övningar är redan med.</p>
        ) : (
          <div className="available-exercise-list">
            {availableExercises.map((exercise) => (
              <button key={exercise.id} type="button" onClick={() => addExercise(exercise)}>
                <Plus aria-hidden="true" size={18} />
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{exercise.category || "Övning"}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
