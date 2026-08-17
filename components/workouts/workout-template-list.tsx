"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Archive, ArrowRight, Loader2, Plus } from "lucide-react";
import { isAdminEmail } from "@/lib/admin/is-admin";
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
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const isAdmin = isAdminEmail(userData.user?.email);
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

      let archivedTemplateIds = new Set<string>();

      if (userId) {
        const { data: archiveRows, error: archiveError } = await supabase
          .from("workout_template_archives")
          .select("workout_template_id")
          .eq("user_id", userId);

        if (archiveError) {
          setErrorMessage(archiveError.message);
          setIsLoading(false);
          return;
        }

        archivedTemplateIds = new Set((archiveRows ?? []).map((row) => row.workout_template_id));
      }

      const visibleTemplates = ((templateRows ?? []) as WorkoutTemplate[])
        .filter((template) => !archivedTemplateIds.has(template.id))
        .filter((template) => !isAdmin || template.created_by === null || template.created_by === userId);
      const templateIds = visibleTemplates.map((template) => template.id);

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
      const exerciseResult = exerciseIds.length > 0
        ? await supabase
            .from("exercises")
            .select("id, name, description, youtube_video_id, thumbnail_url, category, categories, active, created_by, created_at, updated_at")
            .in("id", exerciseIds)
        : { data: [], error: null };

      if (exerciseResult.error) {
        setErrorMessage(exerciseResult.error.message);
        setIsLoading(false);
        return;
      }

      const exercisesById = new Map((exerciseResult.data ?? []).map((exercise) => [exercise.id, exercise]));
      const linksByTemplate = new Map<string, TemplateExercise[]>();

      for (const link of (linkRows ?? []) as TemplateExercise[]) {
        linksByTemplate.set(link.workout_template_id, [
          ...(linksByTemplate.get(link.workout_template_id) ?? []),
          link
        ]);
      }

      setTemplates(
        visibleTemplates.map((template) => ({
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

  async function archiveTemplate(templateId: string) {
    setErrorMessage(null);
    setArchivingIds((current) => new Set(current).add(templateId));

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setErrorMessage("Kunde inte hitta inloggad användare.");
      setArchivingIds((current) => {
        const next = new Set(current);
        next.delete(templateId);
        return next;
      });
      return;
    }

    const { error } = await supabase
      .from("workout_template_archives")
      .insert({
        user_id: userData.user.id,
        workout_template_id: templateId
      }, { defaultToNull: false });

    if (error && error.code !== "23505") {
      setErrorMessage(error.message);
    } else {
      setTemplates((current) => current.filter((template) => template.id !== templateId));
    }

    setArchivingIds((current) => {
      const next = new Set(current);
      next.delete(templateId);
      return next;
    });
  }

  const pageActions = (
    <div className="workout-page-actions">
      <Link className="button" href="/workouts/new">
        <Plus aria-hidden="true" size={20} />
        Skapa nytt pass
      </Link>
      <Link className="button secondary" href="/workouts/archive" title="Visa arkiverade pass">
        <Archive aria-hidden="true" size={20} />
        Arkiv
      </Link>
    </div>
  );

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar färdiga pass...</p>
      </section>
    );
  }

  if (errorMessage && templates.length === 0) {
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
        {pageActions}
        <section className="empty-state card">
          <h2 className="section-title">Inga färdiga pass än</h2>
          <p className="muted">Skapa ett eget pass eller hämta tillbaka ett arkiverat pass.</p>
        </section>
      </>
    );
  }

  return (
    <>
      {pageActions}
      {errorMessage ? <p className="form-message" role="alert">{errorMessage}</p> : null}
      <section className="screen-stack" aria-label="Färdiga pass">
        {templates.map((template) => {
          const firstExercise = template.exercises[0];
          const thumbnailUrl = template.thumbnail_url || (
            firstExercise ? youtubeThumbnail(firstExercise.youtube_video_id) : null
          );

          return (
            <article key={template.id} className="template-card template-card--compact card">
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
              </Link>
              <div className="template-card__actions">
                <Link className="icon-button" href={`/workouts/${template.id}`} title="Öppna pass">
                  <ArrowRight aria-hidden="true" size={20} />
                </Link>
                <button
                  className="icon-button"
                  type="button"
                  title="Arkivera pass"
                  aria-label={`Arkivera ${template.name}`}
                  onClick={() => archiveTemplate(template.id)}
                  disabled={archivingIds.has(template.id)}
                >
                  {archivingIds.has(template.id) ? (
                    <Loader2 className="spin" aria-hidden="true" size={18} />
                  ) : (
                    <Archive aria-hidden="true" size={18} />
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
