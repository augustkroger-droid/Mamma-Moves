"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Edit3, Loader2, Plus, Save, ShieldCheck, X } from "lucide-react";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type WorkoutTemplate = Database["public"]["Tables"]["workout_templates"]["Row"];

type ExerciseForm = {
  id: string | null;
  name: string;
  description: string;
  youtubeInput: string;
  thumbnailUrl: string;
  category: string;
  active: boolean;
};

type WorkoutForm = {
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
  category: "",
  active: true
};

const emptyWorkoutForm: WorkoutForm = {
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
    const admin = isAdminEmail(userData.user?.email);

    setUserId(userData.user?.id ?? null);
    setIsAdmin(admin);

    if (!admin) {
      setIsLoading(false);
      return;
    }

    const [exerciseResult, profileResult, templateResult] = await Promise.all([
      supabase.from("exercises").select("*").order("name", { ascending: true }),
      supabase.from("profiles").select("*").order("username", { ascending: true }),
      supabase.from("workout_templates").select("*").order("created_at", { ascending: false })
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
      youtubeInput: exercise.youtube_video_id,
      thumbnailUrl: exercise.thumbnail_url ?? "",
      category: exercise.category ?? "",
      active: exercise.active
    });
    setActiveTab("exercises");
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      return;
    }

    const youtubeVideoId = extractYoutubeVideoId(exerciseForm.youtubeInput);

    if (!youtubeVideoId) {
      setMessage("Lägg in en YouTube-länk eller ett video-ID.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const payload = {
      name: exerciseForm.name,
      description: exerciseForm.description || null,
      youtube_video_id: youtubeVideoId,
      thumbnail_url: exerciseForm.thumbnailUrl || null,
      category: exerciseForm.category || null,
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

  async function createAdminWorkout(event: FormEvent<HTMLFormElement>) {
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

    const { data: template, error: templateError } = await supabase
      .from("workout_templates")
      .insert({
        name: workoutForm.name,
        description: workoutForm.description || null,
        category: workoutForm.category || null,
        active: true,
        created_by: userId,
        visibility: workoutForm.visibility
      })
      .select("id")
      .single();

    if (templateError || !template) {
      setMessage(templateError?.message ?? "Kunde inte skapa passet.");
      setIsSaving(false);
      return;
    }

    const linkRows = workoutForm.exerciseIds.map((exerciseId, index) => ({
      workout_template_id: template.id,
      exercise_id: exerciseId,
      position: index + 1
    }));

    const { error: linksError } = await supabase.from("workout_template_exercises").insert(linkRows);

    if (linksError) {
      setMessage(linksError.message);
      setIsSaving(false);
      return;
    }

    if (workoutForm.visibility === "selected") {
      const accessRows = workoutForm.userIds.map((profileId) => ({
        workout_template_id: template.id,
        user_id: profileId
      }));
      const { error: accessError } = await supabase.from("workout_template_access").insert(accessRows);

      if (accessError) {
        setMessage(accessError.message);
        setIsSaving(false);
        return;
      }
    }

    setMessage("Passet är skapat.");
    setWorkoutForm(emptyWorkoutForm);
    await loadAdminData();
    setIsSaving(false);
  }

  const selectedWorkoutExercises = workoutForm.exerciseIds
    .map((exerciseId) => exercises.find((exercise) => exercise.id === exerciseId))
    .filter((exercise): exercise is Exercise => Boolean(exercise));

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
        <p className="page-lead">Skapa övningar och pass som kan visas för alla eller för valda användare.</p>
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
              <input value={exerciseForm.youtubeInput} onChange={(event) => setExerciseForm((current) => ({ ...current, youtubeInput: event.target.value }))} required />
            </label>
            <label className="form-field">
              <span>Kategori</span>
              <input value={exerciseForm.category} onChange={(event) => setExerciseForm((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label className="form-field">
              <span>Beskrivning</span>
              <textarea value={exerciseForm.description} onChange={(event) => setExerciseForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </label>
            <label className="form-field">
              <span>Thumbnail URL</span>
              <input value={exerciseForm.thumbnailUrl} onChange={(event) => setExerciseForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} placeholder="Tomt = YouTube-thumbnail" />
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
                  <Image src={exercise.thumbnail_url || youtubeThumbnail(exercise.youtube_video_id)} alt="" width={192} height={120} unoptimized />
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{exercise.category || "Övning"} · {exercise.active ? "Aktiv" : "Inaktiv"}</small>
                  </span>
                </div>
                <button className="icon-button" type="button" onClick={() => editExercise(exercise)} title="Redigera">
                  <Edit3 aria-hidden="true" size={18} />
                </button>
              </article>
            ))}
          </section>
        </>
      ) : (
        <>
          <form className="card workout-editor-panel" onSubmit={createAdminWorkout}>
            <h2 className="section-title">Nytt pass</h2>
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
                    <Image src={exercise.thumbnail_url || youtubeThumbnail(exercise.youtube_video_id)} alt="" width={128} height={80} unoptimized />
                    <span>
                      <strong>{exercise.name}</strong>
                      <small>{exercise.category || "Övning"}</small>
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

            <button className="button full" type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Save aria-hidden="true" size={20} />}
              Skapa pass
            </button>
          </form>

          <section className="card workout-editor-panel">
            <h2 className="section-title">Lägg till övningar</h2>
            <div className="available-exercise-list">
              {exercises.filter((exercise) => exercise.active).map((exercise) => (
                <button key={exercise.id} type="button" onClick={() => toggleWorkoutExercise(exercise.id)} disabled={workoutForm.exerciseIds.includes(exercise.id)}>
                  <Plus aria-hidden="true" size={18} />
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>{exercise.category || "Övning"}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card workout-editor-panel">
            <h2 className="section-title">Senaste pass</h2>
            {templates.length === 0 ? (
              <p className="muted">Inga pass ännu.</p>
            ) : (
              <div className="admin-list">
                {templates.slice(0, 8).map((template) => (
                  <article key={template.id} className="admin-row">
                    <strong>{template.name}</strong>
                    <span>{template.created_by ? template.visibility : "Startpass"}</span>
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
