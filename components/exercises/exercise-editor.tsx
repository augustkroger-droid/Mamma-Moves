"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import {
  collectExerciseCategoryOptions,
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
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
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
    async function loadCategories() {
      const { data, error } = await supabase
        .from("exercises")
        .select("category, categories")
        .eq("active", true);

      if (error) {
        setMessage(error.message);
      } else {
        setCategoryOptions(collectExerciseCategoryOptions((data ?? []) as Exercise[]));
      }

      setIsLoading(false);
    }

    void loadCategories();
  }, [supabase]);

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

    const { error } = await supabase.from("exercises").insert({
      name,
      description: description || null,
      youtube_video_id: parsedVideo.youtubeVideoId,
      video_url: parsedVideo.videoUrl,
      video_provider: parsedVideo.videoProvider,
      thumbnail_url: savedThumbnailUrl,
      category: categories[0] ?? null,
      categories,
      active: true,
      created_by: userData.user.id
    });

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    router.push("/exercises");
    router.refresh();
  }

  return (
    <div className="screen-stack">
      <header>
        <Link className="back-link" href="/exercises">
          <ArrowLeft aria-hidden="true" size={18} />
          Övningar
        </Link>
        <p className="eyebrow">Egen övning</p>
        <h1 className="page-title">Lägg till ny övning.</h1>
        <p className="page-lead">Skapa en egen övning som du kan använda i dina pass.</p>
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
          Spara övning
        </button>
      </form>
    </div>
  );
}
