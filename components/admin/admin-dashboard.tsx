"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X
} from "lucide-react";
import { isAdminEmail } from "@/lib/admin/is-admin";
import {
  collectExerciseCategoryOptions,
  exerciseCategories,
  formatExerciseCategories,
  normalizeCategoryName
} from "@/lib/exercises/categories";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type WorkoutTemplate = Database["public"]["Tables"]["workout_templates"]["Row"];
type TemplateExercise = Database["public"]["Tables"]["workout_template_exercises"]["Row"];
type TemplateAccess = Database["public"]["Tables"]["workout_template_access"]["Row"];

type ExerciseForm = {
  id: string | null;
  name: string;
  description: string;
  youtubeInput: string;
  thumbnailUrl: string;
  categories: string[];
  newCategory: string;
  active: boolean;
};

type WorkoutForm = {
  id: string | null;
  name: string;
  description: string;
  category: string;
  visibility: "all" | "selected";
  exerciseIds: string[];
  userIds: string[];
};

const emptyExerciseForm: ExerciseForm = {
  id: null,
  name: "",
  description: "",
  youtubeInput: "",
  thumbnailUrl: "",
  categories: [],
  newCategory: "",
  active: true
};

const emptyWorkoutForm: WorkoutForm = {
  id: null,
  name: "",
  description: "",
  category: "",
  visibility: "all",
  exerciseIds: [],
  userIds: []
};

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

function extractYoutubeVideoId(value: string) {
  const input = value.trim();

  if (!input) {
    return "";
  }

  try {
    const url = new URL(input);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace("/", "");
    }

    if (url.searchParams.get("v")) {
      return url.searchParams.get("v") ?? "";
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const knownPrefix = ["embed", "shorts", "live"].find((prefix) => pathParts[0] === prefix);

    if (knownPrefix && pathParts[1]) {
      return pathParts[1];
    }
  } catch {
    return input;
  }

  return input;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function templateVisibilityLabel(template: WorkoutTemplate) {
  if (!template.created_by) {
    return "Startpass";
  }

  return template.visibility === "selected" ? "Valda användare" : "Alla användare";
}

function mergeCategories(categories: string[], newCategory: string) {
  const normalizedCategories = categories.map(normalizeCategoryName).filter(Boolean);
  const normalizedNewCategory = normalizeCategoryName(newCategory);

  return [
    ...new Set(
      normalizedNewCategory
        ? [...normalizedCategories, normalizedNewCategory]
        : normalizedCategories
    )
  ];
}

export function AdminDashboard() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [activeTab, setActiveTab] = useState<"exercises" | "workouts">("exercises");
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [exerciseForm, setExerciseForm] = useState<ExerciseForm>(emptyExerciseForm);
  const [workoutForm, setWorkoutForm] = useState<WorkoutForm>(emptyWorkoutForm);
  const [message, setMessage] = useState<string | null>(null);

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id ?? null;
    const admin = isAdminEmail(userData.user?.email);

    setUserId(currentUserId);
    setIsAdmin(admin);

    if (!admin || !currentUserId) {
      setIsLoading(false);
      return;
    }

    const [exerciseResult, profileResult, templateResult] = await Promise.all([
      supabase.from("exercises").select("*").eq("active", true).order("name", { ascending: true }),
      supabase.from("profiles").select("*").order("username", { ascending: true }),
      supabase
        .from("workout_templates")
        .select("*")
        .or(`created_by.is.null,created_by.eq.${currentUserId}`)
        .order("created_at", { ascending: false })
    ]);

    if (exerciseResult.error) {
      setMessage(exerciseResult.error.message);
    } else {
      setExercises((exerciseResult.data ?? []) as Exercise[]);
    }

    if (profileResult.error) {
      setMessage(profileResult.error.message);
    } else {
      setProfiles((profileResult.data ?? []) as Profile[]);
    }

    if (templateResult.error) {
      setMessage(templateResult.error.message);
    } else {
      setTemplates((templateResult.data ?? []) as WorkoutTemplate[]);
    }

    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  function editExercise(exercise: Exercise) {
    setExerciseForm({
      id: exercise.id,
      name: exercise.name,
      description: exercise.description ?? "",
      youtubeInput: exercise.youtube_video_id ?? "",
      thumbnailUrl: exercise.thumbnail_url ?? "",
      categories: exerciseCategories(exercise),
      newCategory: "",
      active: exercise.active
    });
    setActiveTab("exercises");
  }

  function removeExerciseFromAdminState(exerciseId: string) {
    setExercises((current) => current.filter((exercise) => exercise.id !== exerciseId));
    setWorkoutForm((current) => ({
      ...current,
      exerciseIds: current.exerciseIds.filter((id) => id !== exerciseId)
    }));
    setExerciseForm((current) => current.id === exerciseId ? emptyExerciseForm : current);
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      return;
    }

    const youtubeVideoId = extractYoutubeVideoId(exerciseForm.youtubeInput) || null;

    setIsSaving(true);
    setMessage(null);

    const categories = mergeCategories(exerciseForm.categories, exerciseForm.newCategory);
    const payload = {
      name: exerciseForm.name,
      description: exerciseForm.description || null,
      youtube_video_id: youtubeVideoId,
      thumbnail_url: exerciseForm.thumbnailUrl || null,
      category: categories[0] ?? null,
      categories,
      active: exerciseForm.active,
      updated_at: new Date().toISOString()
    };

    const result = exerciseForm.id
      ? await supabase.from("exercises").update(payload).eq("id", exerciseForm.id)
      : await supabase.from("exercises").insert({ ...payload, created_by: userId });

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage(exerciseForm.id ? "Övningen är uppdaterad." : "Övningen är skapad.");
      setExerciseForm(emptyExerciseForm);
      await loadAdminData();
    }

    setIsSaving(false);
  }

  async function deleteExerciseFromAdmin(exercise: Exercise) {
    const confirmed = window.confirm(
      `Är du säker på att du vill radera "${exercise.name}"? Övningen tas bort från pass där den ingår.`
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const linksResult = await supabase
      .from("workout_template_exercises")
      .delete()
      .eq("exercise_id", exercise.id);

    if (linksResult.error) {
      setMessage(linksResult.error.message);
      setIsSaving(false);
      return;
    }

    const deleteResult = await supabase
      .from("exercises")
      .delete()
      .eq("id", exercise.id)
      .select("id");

    if (!deleteResult.error && (deleteResult.data ?? []).length > 0) {
      setMessage("Övningen är raderad.");
      removeExerciseFromAdminState(exercise.id);
      setIsSaving(false);
      return;
    }

    if (deleteResult.error && deleteResult.error.code !== "23503") {
      setMessage(deleteResult.error.message);
      setIsSaving(false);
      return;
    }

    const deactivateResult = await supabase
      .from("exercises")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", exercise.id)
      .select("id");

    if (deactivateResult.error) {
      setMessage(deactivateResult.error.message);
    } else if ((deactivateResult.data ?? []).length === 0) {
      setMessage("Kunde inte radera övningen. Ladda om adminläget och försök igen.");
    } else {
      setMessage("Övningen är borttagen från aktivt innehåll.");
      removeExerciseFromAdminState(exercise.id);
    }

    setIsSaving(false);
  }

  function toggleWorkoutExercise(exerciseId: string) {
    setWorkoutForm((current) => ({
      ...current,
      exerciseIds: current.exerciseIds.includes(exerciseId)
        ? current.exerciseIds.filter((id) => id !== exerciseId)
        : [...current.exerciseIds, exerciseId]
    }));
  }

  function moveWorkoutExercise(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= workoutForm.exerciseIds.length) {
      return;
    }

    setWorkoutForm((current) => ({
      ...current,
      exerciseIds: moveItem(current.exerciseIds, index, nextIndex)
    }));
  }

  function toggleWorkoutUser(userIdToToggle: string) {
    setWorkoutForm((current) => ({
      ...current,
      userIds: current.userIds.includes(userIdToToggle)
        ? current.userIds.filter((id) => id !== userIdToToggle)
        : [...current.userIds, userIdToToggle]
    }));
  }

  function toggleExerciseCategory(category: string) {
    setExerciseForm((current) => ({
      ...current,
      categories: current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category]
    }));
  }

  async function editWorkout(template: WorkoutTemplate) {
    setIsSaving(true);
    setMessage(null);

    const [linksResult, accessResult] = await Promise.all([
      supabase
        .from("workout_template_exercises")
        .select("workout_template_id, exercise_id, position")
        .eq("workout_template_id", template.id)
        .order("position", { ascending: true }),
      supabase
        .from("workout_template_access")
        .select("workout_template_id, user_id, created_at")
        .eq("workout_template_id", template.id)
    ]);

    if (linksResult.error) {
      setMessage(linksResult.error.message);
      setIsSaving(false);
      return;
    }

    if (accessResult.error) {
      setMessage(accessResult.error.message);
      setIsSaving(false);
      return;
    }

    setWorkoutForm({
      id: template.id,
      name: template.name,
      description: template.description ?? "",
      category: template.category ?? "",
      visibility: template.visibility === "selected" ? "selected" : "all",
      exerciseIds: ((linksResult.data ?? []) as TemplateExercise[])
        .sort((first, second) => first.position - second.position)
        .map((link) => link.exercise_id),
      userIds: ((accessResult.data ?? []) as TemplateAccess[]).map((access) => access.user_id)
    });
    setActiveTab("workouts");
    setIsSaving(false);
  }

  async function saveAdminWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      return;
    }

    if (workoutForm.exerciseIds.length === 0) {
      setMessage("Välj minst en övning till passet.");
      return;
    }

    if (workoutForm.visibility === "selected" && workoutForm.userIds.length === 0) {
      setMessage("Välj minst en användare eller gör passet synligt för alla.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const templatePayload = {
      name: workoutForm.name,
      description: workoutForm.description || null,
      category: workoutForm.category || null,
      active: true,
      visibility: workoutForm.visibility,
      updated_at: new Date().toISOString()
    };

    const templateResult = workoutForm.id
      ? await supabase
          .from("workout_templates")
          .update(templatePayload)
          .eq("id", workoutForm.id)
          .select("id")
          .single()
      : await supabase
          .from("workout_templates")
          .insert({ ...templatePayload, created_by: userId })
          .select("id")
          .single();

    if (templateResult.error || !templateResult.data) {
      setMessage(templateResult.error?.message ?? "Kunde inte spara passet.");
      setIsSaving(false);
      return;
    }

    const templateId = templateResult.data.id;

    const deleteLinksResult = await supabase
      .from("workout_template_exercises")
      .delete()
      .eq("workout_template_id", templateId);

    if (deleteLinksResult.error) {
      setMessage(deleteLinksResult.error.message);
      setIsSaving(false);
      return;
    }

    const linkRows = workoutForm.exerciseIds.map((exerciseId, index) => ({
      workout_template_id: templateId,
      exercise_id: exerciseId,
      position: index + 1
    }));

    const linksResult = await supabase.from("workout_template_exercises").insert(linkRows);

    if (linksResult.error) {
      setMessage(linksResult.error.message);
      setIsSaving(false);
      return;
    }

    const deleteAccessResult = await supabase
      .from("workout_template_access")
      .delete()
      .eq("workout_template_id", templateId);

    if (deleteAccessResult.error) {
      setMessage(deleteAccessResult.error.message);
      setIsSaving(false);
      return;
    }

    if (workoutForm.visibility === "selected") {
      const accessRows = workoutForm.userIds.map((profileId) => ({
        workout_template_id: templateId,
        user_id: profileId
      }));
      const accessResult = await supabase.from("workout_template_access").insert(accessRows);

      if (accessResult.error) {
        setMessage(accessResult.error.message);
        setIsSaving(false);
        return;
      }
    }

    setMessage(workoutForm.id ? "Passet är uppdaterat." : "Passet är skapat.");
    setWorkoutForm(emptyWorkoutForm);
    await loadAdminData();
    setIsSaving(false);
  }

  async function deleteWorkout(template: WorkoutTemplate) {
    const confirmed = window.confirm(
      `Är du säker på att du vill radera "${template.name}" permanent för alla användare?`
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const { error } = await supabase.from("workout_templates").delete().eq("id", template.id);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Passet är permanent raderat.");
      setWorkoutForm((current) => current.id === template.id ? emptyWorkoutForm : current);
      await loadAdminData();
    }

    setIsSaving(false);
  }

  const selectedWorkoutExercises = workoutForm.exerciseIds
    .map((exerciseId) => exercises.find((exercise) => exercise.id === exerciseId))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const availableWorkoutExercises = exercises.filter((exercise) => exercise.active);
  const exerciseCategoryOptions = collectExerciseCategoryOptions(exercises);

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar adminläge...</p>
      </section>
    );
  }

  if (!isAdmin) {
    return (
      <section className="empty-state card">
        <ShieldCheck aria-hidden="true" size={38} />
        <h1 className="section-title">Adminläge</h1>
        <p className="muted">Det här läget är bara öppet för adminkontot.</p>
      </section>
    );
  }

  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Admin</p>
        <h1 className="page-title">Innehåll.</h1>
        <p className="page-lead">Hantera övningar och gemensamma pass för appen.</p>
      </header>

      <div className="segmented-control admin-tabs" role="tablist" aria-label="Adminflikar">
        <button type="button" aria-pressed={activeTab === "exercises"} onClick={() => setActiveTab("exercises")}>
          Övningar
        </button>
        <button type="button" aria-pressed={activeTab === "workouts"} onClick={() => setActiveTab("workouts")}>
          Pass
        </button>
      </div>

      {message ? <p className="form-message">{message}</p> : null}

      {activeTab === "exercises" ? (
        <>
          <form className="card workout-editor-panel" onSubmit={saveExercise}>
            <h2 className="section-title">{exerciseForm.id ? "Redigera övning" : "Ny övning"}</h2>
            <label className="form-field">
              <span>Namn</span>
              <input value={exerciseForm.name} onChange={(event) => setExerciseForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="form-field">
              <span>YouTube-länk eller video-ID</span>
              <input value={exerciseForm.youtubeInput} onChange={(event) => setExerciseForm((current) => ({ ...current, youtubeInput: event.target.value }))} placeholder="Valfritt" />
            </label>
            <div className="form-field">
              <span>Kategorier</span>
              <details className="category-picker">
                <summary>
                  {exerciseForm.categories.length > 0
                    ? exerciseForm.categories.join(", ")
                    : "Välj kategorier"}
                </summary>
                <div className="category-picker__menu">
                  {exerciseCategoryOptions.length === 0 ? (
                    <p className="muted">Inga kategorier ännu.</p>
                  ) : (
                    exerciseCategoryOptions.map((category) => (
                      <label key={category} className="check-row">
                        <input
                          type="checkbox"
                          checked={exerciseForm.categories.includes(category)}
                          onChange={() => toggleExerciseCategory(category)}
                        />
                        <span>{category}</span>
                      </label>
                    ))
                  )}
                </div>
              </details>
              <input
                value={exerciseForm.newCategory}
                onChange={(event) => setExerciseForm((current) => ({ ...current, newCategory: event.target.value }))}
                placeholder="Lägg till ny kategori"
              />
            </div>
            <label className="form-field">
              <span>Beskrivning</span>
              <textarea value={exerciseForm.description} onChange={(event) => setExerciseForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </label>
            <label className="form-field">
              <span>Bildlänk</span>
              <input value={exerciseForm.thumbnailUrl} onChange={(event) => setExerciseForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} placeholder="Tomt = YouTube-bild" />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={exerciseForm.active} onChange={(event) => setExerciseForm((current) => ({ ...current, active: event.target.checked }))} />
              Aktiv
            </label>
            <div className="admin-inline-actions">
              <button className="button" type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Save aria-hidden="true" size={20} />}
                Spara övning
              </button>
              {exerciseForm.id ? (
                <button className="button secondary" type="button" onClick={() => setExerciseForm(emptyExerciseForm)}>
                  <X aria-hidden="true" size={20} />
                  Avbryt
                </button>
              ) : null}
            </div>
          </form>

          <section className="screen-stack" aria-label="Adminövningar">
            {exercises.map((exercise) => (
              <article key={exercise.id} className="template-card template-card--compact card">
                <div className="template-card__link archive-template-summary">
                  {exerciseImageUrl(exercise) ? (
                    <Image src={exerciseImageUrl(exercise) ?? ""} alt="" width={192} height={120} unoptimized />
                  ) : (
                    <span className="template-fallback" aria-hidden="true" />
                  )}
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{formatExerciseCategories(exercise)} · {exercise.active ? "Aktiv" : "Inaktiv"}</small>
                  </span>
                </div>
                <div className="template-card__actions">
                  <button className="icon-button" type="button" onClick={() => editExercise(exercise)} title="Redigera">
                    <Edit3 aria-hidden="true" size={18} />
                  </button>
                  <button className="icon-button danger-icon-button" type="button" onClick={() => deleteExerciseFromAdmin(exercise)} title="Radera">
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : (
        <>
          <form className="card workout-editor-panel" onSubmit={saveAdminWorkout}>
            <h2 className="section-title">{workoutForm.id ? "Redigera pass" : "Nytt pass"}</h2>
            <label className="form-field">
              <span>Namn</span>
              <input value={workoutForm.name} onChange={(event) => setWorkoutForm((current) => ({ ...current, name: event.target.value }))} required />
            </label>
            <label className="form-field">
              <span>Kategori</span>
              <input value={workoutForm.category} onChange={(event) => setWorkoutForm((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label className="form-field">
              <span>Beskrivning</span>
              <textarea value={workoutForm.description} onChange={(event) => setWorkoutForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </label>

            <div className="segmented-control">
              <button type="button" aria-pressed={workoutForm.visibility === "all"} onClick={() => setWorkoutForm((current) => ({ ...current, visibility: "all" }))}>
                Alla
              </button>
              <button type="button" aria-pressed={workoutForm.visibility === "selected"} onClick={() => setWorkoutForm((current) => ({ ...current, visibility: "selected" }))}>
                Valda
              </button>
            </div>

            {workoutForm.visibility === "selected" ? (
              <div className="admin-check-list" aria-label="Välj användare">
                {profiles.map((profile) => (
                  <label key={profile.id} className="check-row">
                    <input type="checkbox" checked={workoutForm.userIds.includes(profile.id)} onChange={() => toggleWorkoutUser(profile.id)} />
                    <span>{profile.email || profile.username}</span>
                  </label>
                ))}
              </div>
            ) : null}

            <h3 className="section-title">Valda övningar</h3>
            {selectedWorkoutExercises.length === 0 ? (
              <p className="muted">Välj övningar nedan.</p>
            ) : (
              <div className="editable-exercise-list">
                {selectedWorkoutExercises.map((exercise, index) => (
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
                      <button type="button" onClick={() => moveWorkoutExercise(index, -1)} disabled={index === 0} title="Flytta upp">
                        <ArrowUp aria-hidden="true" size={18} />
                      </button>
                      <button type="button" onClick={() => moveWorkoutExercise(index, 1)} disabled={index === selectedWorkoutExercises.length - 1} title="Flytta ner">
                        <ArrowDown aria-hidden="true" size={18} />
                      </button>
                      <button type="button" onClick={() => toggleWorkoutExercise(exercise.id)} title="Ta bort">
                        <X aria-hidden="true" size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="admin-inline-actions">
              <button className="button full" type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Save aria-hidden="true" size={20} />}
                {workoutForm.id ? "Spara pass" : "Skapa pass"}
              </button>
              {workoutForm.id ? (
                <button className="button secondary full" type="button" onClick={() => setWorkoutForm(emptyWorkoutForm)}>
                  <X aria-hidden="true" size={20} />
                  Avbryt
                </button>
              ) : null}
            </div>
          </form>

          <section className="card workout-editor-panel">
            <h2 className="section-title">Lägg till övningar</h2>
            <div className="available-exercise-list">
              {availableWorkoutExercises.map((exercise) => (
                <button key={exercise.id} type="button" onClick={() => toggleWorkoutExercise(exercise.id)} disabled={workoutForm.exerciseIds.includes(exercise.id)}>
                  <Plus aria-hidden="true" size={18} />
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{formatExerciseCategories(exercise)}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card workout-editor-panel">
            <h2 className="section-title">Pass i appen</h2>
            {templates.length === 0 ? (
              <p className="muted">Inga pass ännu.</p>
            ) : (
              <div className="admin-list">
                {templates.map((template) => (
                  <article key={template.id} className="admin-row">
                    <span className="admin-row__body">
                      <strong>{template.name}</strong>
                      <small>{templateVisibilityLabel(template)}</small>
                    </span>
                    <span className="admin-row__actions">
                      <button className="icon-button" type="button" onClick={() => void editWorkout(template)} title="Redigera pass">
                        <Edit3 aria-hidden="true" size={18} />
                      </button>
                      <button className="icon-button danger-icon-button" type="button" onClick={() => void deleteWorkout(template)} title="Radera permanent">
                        <Trash2 aria-hidden="true" size={18} />
                      </button>
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

