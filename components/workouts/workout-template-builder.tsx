"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Save, X } from "lucide-react";
import { formatExerciseCategories } from "@/lib/exercises/categories";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

function youtubeThumbnail(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function exerciseImageUrl(exercise: Pick<Exercise, "thumbnail_url" | "youtube_video_id">) {
  if (exercise.thumbnail_url) {
    return exercise.thumbnail_url;
  }

  if (exercise.youtube_video_id) {
    return youtubeThumbnail(exercise.youtube_video_id);
  }

  return null;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function WorkoutTemplateBuilder() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
        setAllExercises((data ?? []) as Exercise[]);
      }

      setIsLoading(false);
    }

    void loadExercises();
  }, [supabase]);

  function addExercise(exercise: Exercise) {
    setSelectedExercises((current) => [...current, exercise]);
  }

  function removeExercise(exerciseId: string) {
    setSelectedExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
  }

  function moveExercise(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selectedExercises.length) {
      return;
    }

    setSelectedExercises((current) => moveItem(current, index, nextIndex));
  }

  async function createWorkoutTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedExercises.length === 0) {
      setErrorMessage("Välj minst en övning.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setErrorMessage("Kunde inte hitta inloggad användare.");
      setIsSaving(false);
      return;
    }

    const { data: template, error: templateError } = await supabase
      .from("workout_templates")
      .insert({
        name,
        description: description || null,
        category: "Eget",
        active: true,
        created_by: userData.user.id
      })
      .select("id")
      .single();

    if (templateError || !template) {
      setErrorMessage(templateError?.message ?? "Kunde inte skapa passet.");
      setIsSaving(false);
      return;
    }

    const rows = selectedExercises.map((exercise, index) => ({
      workout_template_id: template.id,
      exercise_id: exercise.id,
      position: index + 1
    }));

    const { error: linksError } = await supabase.from("workout_template_exercises").insert(rows);

    if (linksError) {
      setErrorMessage(linksError.message);
      setIsSaving(false);
      return;
    }

    router.push(`/workouts/${template.id}`);
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
        <p className="eyebrow">Eget pass</p>
        <h1 className="page-title">Skapa nytt pass.</h1>
        <p className="page-lead">Välj övningar, ordna dem och spara passet till din lista.</p>
      </header>

      <form className="card workout-editor-panel" onSubmit={createWorkoutTemplate}>
        <label className="form-field">
          <span>Namn på passet</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="form-field">
          <span>Beskrivning</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>

        <h2 className="section-title">Valda övningar</h2>
        {selectedExercises.length === 0 ? (
          <p className="muted">Lägg till övningar nedan.</p>
        ) : (
          <div className="editable-exercise-list">
            {selectedExercises.map((exercise, index) => (
              <article key={exercise.id} className="editable-exercise-row">
                {exerciseImageUrl(exercise) ? (
                  <Image src={exerciseImageUrl(exercise) ?? ""} alt="" width={128} height={80} unoptimized />
                ) : (
                  <span className="template-fallback" aria-hidden="true" />
                )}
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{formatExerciseCategories(exercise)}</small>
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

        {errorMessage ? <p className="form-message">{errorMessage}</p> : null}
        <button className="button full" type="submit" disabled={isSaving || selectedExercises.length === 0}>
          {isSaving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Save aria-hidden="true" size={20} />}
          Spara pass
        </button>
      </form>

      <section className="card workout-editor-panel">
        <h2 className="section-title">Alla övningar</h2>
        {isLoading ? (
          <div className="empty-state">
            <Loader2 className="spin" aria-hidden="true" />
            <p>Hämtar övningar...</p>
          </div>
        ) : availableExercises.length === 0 ? (
          <p className="muted">Alla övningar är redan valda.</p>
        ) : (
          <div className="available-exercise-list">
            {availableExercises.map((exercise) => (
              <button key={exercise.id} type="button" onClick={() => addExercise(exercise)}>
                <Plus aria-hidden="true" size={18} />
                <span>
                  <strong>{exercise.name}</strong>
                  <small>{formatExerciseCategories(exercise)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
