import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const exerciseImageBucket = "exercise-images";
const maxExerciseImageSize = 5 * 1024 * 1024;

function extensionForFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (extension) {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function imagePath(userId: string, file: File) {
  const id = crypto.randomUUID();
  const extension = extensionForFile(file);

  return `${userId}/${id}.${extension}`;
}

export async function uploadExerciseImage(
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  userId: string,
  file: File
) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Välj en bildfil.");
  }

  if (file.size > maxExerciseImageSize) {
    throw new Error("Bilden får vara högst 5 MB.");
  }

  const path = imagePath(userId, file);
  const { error } = await supabase.storage
    .from(exerciseImageBucket)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(exerciseImageBucket).getPublicUrl(path);

  return data.publicUrl;
}
