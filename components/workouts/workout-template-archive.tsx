"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArchiveRestore, ArrowLeft, Loader2, Trash2 } from "lucide-react";
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

export function WorkoutTemplateArchive() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([]);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadArchivedTemplates() {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        setErrorMessage("Kunde inte hitta inloggad användare.");
        setIsLoading(false);
        return;
      }

      setUserId(userData.user.id);

      const { data: archiveRows, error: archiveError } = await supabase
        .from("workout_template_archives")
        .select("workout_template_id")
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("archived_at", { ascending: false });

      if (archiveError) {
        setErrorMessage(archiveError.message);
        setIsLoading(false);
        return;
      }

      const templateIds = (archiveRows ?? []).map((row) => row.workout_template_id);

      if (templateIds.length === 0) {
        setTemplates([]);
        setIsLoading(false);
        return;
      }

      const [templatesResult, linksResult] = await Promise.all([
        supabase.from("workout_templates").select("*").in("id", templateIds).order("name", { ascending: true }),
        supabase
          .from("workout_template_exercises")
          .select("workout_template_id, exercise_id, position")
          .in("workout_template_id", templateIds)
          .order("position", { ascending: true })
      ]);

      if (templatesResult.error) {
        setErrorMessage(templatesResult.error.message);
        setIsLoading(false);
        return;
      }

      if (linksResult.error) {
        setErrorMessage(linksResult.error.message);
        setIsLoading(false);
        return;
      }

      const exerciseIds = [...new Set((linksResult.data ?? []).map((link) => link.exercise_id))];
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

      for (const link of (linksResult.data ?? []) as TemplateExercise[]) {
        linksByTemplate.set(link.workout_template_id, [
          ...(linksByTemplate.get(link.workout_template_id) ?? []),
          link
        ]);
      }

      const templateOrder = new Map(templateIds.map((id, index) => [id, index]));

      setTemplates(
        ((templatesResult.data ?? []) as WorkoutTemplate[])
          .sort((first, second) => (templateOrder.get(first.id) ?? 0) - (templateOrder.get(second.id) ?? 0))
          .map((template) => ({
            ...template,
            exercises: (linksByTemplate.get(template.id) ?? [])
              .sort((first, second) => first.position - second.position)
              .map((link) => exercisesById.get(link.exercise_id))
              .filter((exercise): exercise is Exercise => Boolean(exercise))
          }))
      );
      setIsLoading(false);
    }

    void loadArchivedTemplates();
  }, [supabase]);

  async function restoreTemplate(templateId: string) {
    if (!userId) {
      return;
    }

    setErrorMessage(null);
    setBusyIds((current) => new Set(current).add(templateId));

    const { error } = await supabase
      .from("workout_template_archives")
      .delete()
      .eq("user_id", userId)
      .eq("workout_template_id", templateId);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setTemplates((current) => current.filter((template) => template.id !== templateId));
    }

    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(templateId);
      return next;
    });
  }

  async function deleteTemplate(templateId: string) {
    if (!userId) {
      return;
    }

    const template = templates.find((item) => item.id === templateId);

    if (!template) {
      return;
    }

    const confirmed = window.confirm(`Är du säker på att du vill radera "${template.name}" permanent?`);

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    setBusyIds((current) => new Set(current).add(templateId));

    const result = template.created_by === userId && template.visibility === "private"
      ? await supabase.from("workout_templates").delete().eq("id", templateId)
      : await supabase
          .from("workout_template_archives")
          .update({ deleted_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("workout_template_id", templateId);

    if (result.error) {
      setErrorMessage(result.error.message);
    } else {
      setTemplates((current) => current.filter((template) => template.id !== templateId));
    }

    setBusyIds((current) => {
      const next = new Set(current);
      next.delete(templateId);
      return next;
    });
  }

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar arkiverade pass...</p>
      </section>
    );
  }

  return (
    <div className="screen-stack">
      <Link className="back-link" href="/workouts">
        <ArrowLeft aria-hidden="true" size={18} />
        Pass
      </Link>

      <header>
        <p className="eyebrow">Arkiv</p>
        <h1 className="page-title">Arkiverade pass.</h1>
        <p className="page-lead">Här kan du hämta tillbaka pass till passidan eller radera dem från ditt konto.</p>
      </header>

      {errorMessage ? <p className="form-message" role="alert">{errorMessage}</p> : null}

      {templates.length === 0 ? (
        <section className="empty-state card">
          <h2 className="section-title">Arkivet är tomt</h2>
          <p className="muted">När du arkiverar pass visas de här.</p>
        </section>
      ) : (
        <section className="screen-stack" aria-label="Arkiverade pass">
          {templates.map((template) => {
          const firstExercise = template.exercises[0];
          const thumbnailUrl = template.thumbnail_url || (
            firstExercise?.youtube_video_id ? youtubeThumbnail(firstExercise.youtube_video_id) : null
          );
            const isBusy = busyIds.has(template.id);

            return (
              <article key={template.id} className="archive-card card">
                <div className="archive-card__summary">
                  {thumbnailUrl ? (
                    <Image src={thumbnailUrl} alt="" width={152} height={96} unoptimized />
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
                </div>
                <div className="archive-card__actions" aria-label={`Åtgärder för ${template.name}`}>
                  <button
                    className="archive-card__button"
                    type="button"
                    title="Hämta tillbaka"
                    aria-label={`Hämta tillbaka ${template.name}`}
                    onClick={() => restoreTemplate(template.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? (
                      <Loader2 className="spin" aria-hidden="true" size={18} />
                    ) : (
                      <ArchiveRestore aria-hidden="true" size={18} />
                    )}
                  </button>
                  <button
                    className="archive-card__button archive-card__button--danger"
                    type="button"
                    title="Radera permanent"
                    aria-label={`Radera ${template.name} permanent från ditt konto`}
                    onClick={() => deleteTemplate(template.id)}
                    disabled={isBusy}
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
