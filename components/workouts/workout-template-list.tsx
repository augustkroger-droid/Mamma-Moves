"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { type WorkoutExercise } from "@/lib/workouts/active-workout";
import type { Database } from "@/types/database";

type WorkoutTemplate = Database["public"]["Tables"]["workout_templates"]["Row"];
type TemplateExercise = Database["public"]["Tables"]["workout_template_exercises"]["Row"];
type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

type TemplateWithExercises = WorkoutTemplate & {
  exercises: WorkoutExercise[];
};

function youtubeThumbnail(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function WorkoutTemplateList() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const { data: templateRows, error: templateError } = await supabase
        .from("workout_templates")
        .select("*")
        .eq("active", true)
        .order("name", { ascending: true });

      if (templateError) {
        setErrorMessage(templateError.message);
        setIsLoading(false);
        return;
      }

      const templateIds = (templateRows ?? []).map((template) => template.id);

      if (templateIds.length === 0) {
        setTemplates([]);
        setIsLoading(false);
        return;
      }

      const { data: linkRows, error: linkError } = await supabase
        .from("workout_template_exercises")
        .select("workout_template_id, exercise_id, position")
        .in("workout_template_id", templateIds)
        .order("position", { ascending: true });

      if (linkError) {
        setErrorMessage(linkError.message);
        setIsLoading(false);
        return;
      }

      const exerciseIds = [...new Set((linkRows ?? []).map((link) => link.exercise_id))];
      const { data: exerciseRows, error: exerciseError } = await supabase
        .from("exercises")
        .select("id, name, description, youtube_video_id, thumbnail_url, category, active, created_by, created_at, updated_at")
        .in("id", exerciseIds);

      if (exerciseError) {
        setErrorMessage(exerciseError.message);
        setIsLoading(false);
        return;
      }

      const exercisesById = new Map((exerciseRows ?? []).map((exercise) => [exercise.id, exercise]));
      const linksByTemplate = new Map<string, TemplateExercise[]>();

      for (const link of (linkRows ?? []) as TemplateExercise[]) {
        linksByTemplate.set(link.workout_template_id, [
          ...(linksByTemplate.get(link.workout_template_id) ?? []),
          link
        ]);
      }

      setTemplates(
        ((templateRows ?? []) as WorkoutTemplate[]).map((template) => ({
          ...template,
          exercises: (linksByTemplate.get(template.id) ?? [])
            .sort((first, second) => first.position - second.position)
            .map((link) => exercisesById.get(link.exercise_id))
            .filter((exercise): exercise is Exercise => Boolean(exercise))
        }))
      );
      setIsLoading(false);
    }

    void loadTemplates();
  }, [supabase]);

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar färdiga pass...</p>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="empty-state card" role="alert">
        <h2 className="section-title">Kunde inte hämta pass</h2>
        <p className="muted">{errorMessage}</p>
      </section>
    );
  }

  if (templates.length === 0) {
    return (
      <>
        <Link className="button full" href="/workouts/new">
          <Plus aria-hidden="true" size={20} />
          Skapa nytt pass
        </Link>
        <section className="empty-state card">
          <h2 className="section-title">Inga färdiga pass än</h2>
          <p className="muted">Lägg in pass i Supabase så visas de här.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <Link className="button full" href="/workouts/new">
        <Plus aria-hidden="true" size={20} />
        Skapa nytt pass
      </Link>
      <section className="screen-stack" aria-label="Färdiga pass">
        {templates.map((template) => {
          const firstExercise = template.exercises[0];
          const thumbnailUrl = template.thumbnail_url || (
            firstExercise ? youtubeThumbnail(firstExercise.youtube_video_id) : null
          );

          return (
            <article key={template.id} className="template-card card">
              <Link href={`/workouts/${template.id}`} className="template-card__link">
                {thumbnailUrl ? (
                  <Image src={thumbnailUrl} alt="" width={192} height={120} unoptimized />
                ) : (
                  <span className="template-fallback" aria-hidden="true" />
                )}
                <span>
                  <strong>{template.name}</strong>
                  <small>
                    {template.exercises.length} övningar
                    {template.category ? ` · ${template.category}` : ""}
                  </small>
                  {template.description ? <em>{template.description}</em> : null}
                </span>
                <span className="select-indicator" aria-hidden="true">
                  <ArrowRight size={20} />
                </span>
              </Link>
            </article>
          );
        })}
      </section>
    </>
  );
}
