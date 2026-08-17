"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import {
  collectExerciseCategoryOptions,
  normalizeCategoryName
} from "@/lib/exercises/categories";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Exercise = Database["public"]["Tables"]["exercises"]["Row"];

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
  const [youtubeInput, setYoutubeInput] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
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
    const { error } = await supabase.from("exercises").insert({
      name,
      description: description || null,
      youtube_video_id: extractYoutubeVideoId(youtubeInput) || null,
      thumbnail_url: thumbnailUrl || null,
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
          <span>YouTube-länk eller video-ID</span>
          <input
            value={youtubeInput}
            onChange={(event) => setYoutubeInput(event.target.value)}
            placeholder="Valfritt"
          />
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
            placeholder="Tomt = YouTube-bild eller fallback"
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
