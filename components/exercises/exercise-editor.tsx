"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import {
  collectExerciseCategoryOptions,
  exerciseCategories,
  normalizeCategoryName
} from "@/lib/exercises/categories";
import { uploadExerciseImage } from "@/lib/exercises/image-upload";
import { parseExerciseVideo } from "@/lib/exercises/video";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

function mergeCategories(categories: string[], newCategory: string) {
  return [
    ...new Set(
      [...categories, normalizeCategoryName(newCategory)]
        .map(normalizeCategoryName)
        .filter(Boolean)
    )
  ];
}

export function ExerciseEditor() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const exerciseId = params.id ?? null;
  const isEditing = Boolean(exerciseId);
  const [name, setName] = useState("");
  const [videoInput, setVideoInput] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadEditorData() {
      const [userResult, categoryResult, exerciseResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("exercises")
          .select("category, categories")
          .eq("active", true),
        exerciseId
          ? supabase
              .from("exercises")
              .select("*")
              .eq("id", exerciseId)
              .single()
          : Promise.resolve({ data: null, error: null })
      ]);

      if (categoryResult.error) {
        setMessage(categoryResult.error.message);
      } else {
        setCategoryOptions(collectExerciseCategoryOptions((categoryResult.data ?? []) as Exercise[]));
      }

      if (exerciseResult.error) {
        setMessage(exerciseResult.error.message);
      } else if (exerciseResult.data) {
        const exercise = exerciseResult.data as Exercise;
        const currentUserId = userResult.data.user?.id ?? null;

        if (!currentUserId || exercise.created_by !== currentUserId) {
          setMessage("Du kan bara redigera övningar som du själv har skapat.");
        } else {
          setName(exercise.name);
          setVideoInput(exercise.video_url ?? exercise.youtube_video_id ?? "");
          setDescription(exercise.description ?? "");
          setThumbnailUrl(exercise.thumbnail_url ?? "");
          setSelectedCategories(exerciseCategories(exercise));
        }
      }

      setIsLoading(false);
    }

    void loadEditorData();
  }, [exerciseId, supabase]);

  async function reloadCategoryOptions() {
    const { data, error } = await supabase
      .from("exercises")
      .select("category, categories")
      .eq("active", true);

    if (!error) {
      setCategoryOptions(collectExerciseCategoryOptions((data ?? []) as Exercise[]));
    }
  }

  function toggleCategory(category: string) {
    setSelectedCategories((current) => (
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    ));
  }

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setMessage("Kunde inte hitta inloggad användare.");
      setIsSaving(false);
      return;
    }

    const categories = mergeCategories(selectedCategories, newCategory);
    const parsedVideo = parseExerciseVideo(videoInput);
    let savedThumbnailUrl = thumbnailUrl || null;

    try {
      if (imageFile) {
        savedThumbnailUrl = await uploadExerciseImage(supabase, userData.user.id, imageFile);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kunde inte ladda upp bilden.");
      setIsSaving(false);
      return;
    }

    const payload = {
      name,
      description: description || null,
      youtube_video_id: parsedVideo.youtubeVideoId,
      video_url: parsedVideo.videoUrl,
      video_provider: parsedVideo.videoProvider,
      thumbnail_url: savedThumbnailUrl,
      category: categories[0] ?? null,
      categories,
      active: true
    };

    const result = exerciseId
      ? await supabase
          .from("exercises")
          .update(payload)
          .eq("id", exerciseId)
          .eq("created_by", userData.user.id)
          .select("id")
          .single()
      : await supabase
          .from("exercises")
          .insert({
            ...payload,
            created_by: userData.user.id
          })
          .select("id")
          .single();

    if (result.error) {
      setMessage(result.error.message);
      setIsSaving(false);
      return;
    }

    await reloadCategoryOptions();
    router.push("/exercises");
    router.refresh();
  }

  if (isLoading) {
    return (
      <section className="empty-state card" aria-live="polite">
        <Loader2 className="spin" aria-hidden="true" />
        <p>Hämtar övning...</p>
      </section>
    );
  }

  return (
    <div className="screen-stack">
      <header>
        <Link className="back-link" href="/exercises">
          <ArrowLeft aria-hidden="true" size={18} />
          Övningar
        </Link>
        <p className="eyebrow">Egen övning</p>
        <h1 className="page-title">{isEditing ? "Redigera övning." : "Lägg till ny övning."}</h1>
        <p className="page-lead">
          {isEditing
            ? "Ändra övningen så den passar dina pass."
            : "Skapa en egen övning som du kan använda i dina pass."}
        </p>
      </header>

      <form className="card workout-editor-panel" onSubmit={saveExercise}>
        <label className="form-field">
          <span>Namn</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>

        <label className="form-field">
          <span>Videolänk</span>
          <input
            value={videoInput}
            onChange={(event) => setVideoInput(event.target.value)}
            placeholder="Valfritt, t.ex. YouTube, Instagram eller Facebook"
          />
        </label>

        <label className="form-field">
          <span>Bild</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          />
          {imageFile ? <small className="field-hint">{imageFile.name}</small> : null}
        </label>

        <div className="form-field">
          <span>Kategorier</span>
          <details className="category-picker">
            <summary>
              {selectedCategories.length > 0 ? selectedCategories.join(", ") : "Välj kategorier"}
            </summary>
            <div className="category-picker__menu">
              {isLoading ? (
                <p className="muted">Hämtar kategorier...</p>
              ) : categoryOptions.length === 0 ? (
                <p className="muted">Inga kategorier ännu.</p>
              ) : (
                categoryOptions.map((category) => (
                  <label key={category} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    <span>{category}</span>
                  </label>
                ))
              )}
            </div>
          </details>
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Lägg till ny kategori"
          />
        </div>

        <label className="form-field">
          <span>Beskrivning</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
        </label>

        <label className="form-field">
          <span>Bildlänk</span>
          <input
            value={thumbnailUrl}
            onChange={(event) => setThumbnailUrl(event.target.value)}
            placeholder="Valfritt, annars YouTube-bild eller fallback"
          />
        </label>

        {message ? <p className="form-message">{message}</p> : null}

        <button className="button full" type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : <Save aria-hidden="true" size={20} />}
          {isEditing ? "Spara ändringar" : "Spara övning"}
        </button>
      </form>
    </div>
  );
}
