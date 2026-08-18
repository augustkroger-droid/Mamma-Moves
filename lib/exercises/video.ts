import type { Database } from "@/types/database";

export type ExerciseVideoProvider = "youtube" | "instagram" | "facebook" | "external" | "none";

type ExerciseVideoFields = Pick<
  Database["public"]["Tables"]["exercises"]["Row"],
  "youtube_video_id" | "video_url" | "video_provider"
>;

type ParsedExerciseVideo = {
  videoProvider: ExerciseVideoProvider;
  videoUrl: string | null;
  youtubeVideoId: string | null;
};

function normalizeHost(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function parseUrl(value: string) {
  const input = value.trim();

  if (!input) {
    return null;
  }

  try {
    return new URL(input);
  } catch {
    try {
      return new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
}

export function extractYoutubeVideoId(value: string) {
  const input = value.trim();

  if (!input) {
    return null;
  }

  if (!input.includes(".") && !input.includes("/") && !input.includes(":") && /^[a-zA-Z0-9_-]{6,}$/.test(input)) {
    return input;
  }

  const url = parseUrl(input);

  if (!url) {
    return input;
  }

  const hostname = normalizeHost(url.hostname);

  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (!hostname.endsWith("youtube.com") && !hostname.endsWith("youtube-nocookie.com")) {
    return null;
  }

  const watchId = url.searchParams.get("v");
  if (watchId) {
    return watchId;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const knownPrefix = ["embed", "shorts", "live"].find((prefix) => pathParts[0] === prefix);

  return knownPrefix ? pathParts[1] ?? null : null;
}

export function parseExerciseVideo(value: string): ParsedExerciseVideo {
  const input = value.trim();

  if (!input) {
    return {
      videoProvider: "none",
      videoUrl: null,
      youtubeVideoId: null
    };
  }

  const youtubeVideoId = extractYoutubeVideoId(input);

  if (youtubeVideoId) {
    return {
      videoProvider: "youtube",
      videoUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
      youtubeVideoId
    };
  }

  const url = parseUrl(input);

  if (!url) {
    return {
      videoProvider: "external",
      videoUrl: input,
      youtubeVideoId: null
    };
  }

  const hostname = normalizeHost(url.hostname);

  if (hostname.endsWith("instagram.com")) {
    return {
      videoProvider: "instagram",
      videoUrl: url.toString(),
      youtubeVideoId: null
    };
  }

  if (hostname.endsWith("facebook.com") || hostname === "fb.watch" || hostname.endsWith("fb.com")) {
    return {
      videoProvider: "facebook",
      videoUrl: url.toString(),
      youtubeVideoId: null
    };
  }

  return {
    videoProvider: "external",
    videoUrl: url.toString(),
    youtubeVideoId: null
  };
}

export function youtubeThumbnail(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function exerciseImageUrl(exercise: Pick<ExerciseVideoFields, "youtube_video_id"> & { thumbnail_url: string | null }) {
  if (exercise.thumbnail_url) {
    return exercise.thumbnail_url;
  }

  if (exercise.youtube_video_id) {
    return youtubeThumbnail(exercise.youtube_video_id);
  }

  return null;
}

export function exerciseEmbedUrl(exercise: ExerciseVideoFields) {
  const provider = exercise.video_provider ?? (exercise.youtube_video_id ? "youtube" : "none");

  if (provider === "youtube" && exercise.youtube_video_id) {
    return `https://www.youtube.com/embed/${exercise.youtube_video_id}`;
  }

  if ((provider === "instagram" || provider === "facebook") && exercise.video_url) {
    const url = parseUrl(exercise.video_url);

    if (!url) {
      return null;
    }

    if (provider === "instagram") {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const contentPrefix = ["p", "reel", "tv"].find((prefix) => pathParts[0] === prefix);

      return contentPrefix && pathParts[1]
        ? `https://www.instagram.com/${contentPrefix}/${pathParts[1]}/embed`
        : null;
    }

    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.toString())}&show_text=false&width=720`;
  }

  return null;
}

export function youtubeWorkoutPlaylistUrl(exercises: ExerciseVideoFields[]) {
  if (exercises.length === 0) {
    return null;
  }

  const videoIds = exercises.map((exercise) => (
    (exercise.video_provider === "youtube" || (!exercise.video_provider && exercise.youtube_video_id))
      ? exercise.youtube_video_id
      : null
  ));

  if (videoIds.some((videoId) => !videoId)) {
    return null;
  }

  return `https://www.youtube.com/watch_videos?video_ids=${videoIds.slice(0, 50).join(",")}`;
}
