import type { Database } from "@/types/database";

export type WorkoutExercise = Pick<
  Database["public"]["Tables"]["exercises"]["Row"],
  "id" | "name" | "description" | "youtube_video_id" | "thumbnail_url" | "category" | "categories"
>;

export type ActiveWorkout = {
  sessionId?: string;
  title: string;
  workoutTemplateId: string | null;
  returnHref?: string;
  exercises: WorkoutExercise[];
};

export const activeWorkoutStorageKey = "mammaMovesActiveWorkout";

export function saveActiveWorkout(workout: ActiveWorkout) {
  window.sessionStorage.setItem(activeWorkoutStorageKey, JSON.stringify(workout));
}

export function readActiveWorkout(): ActiveWorkout | null {
  const rawWorkout = window.sessionStorage.getItem(activeWorkoutStorageKey);
  if (!rawWorkout) {
    return null;
  }

  try {
    return JSON.parse(rawWorkout) as ActiveWorkout;
  } catch {
    window.sessionStorage.removeItem(activeWorkoutStorageKey);
    return null;
  }
}

export function clearActiveWorkout() {
  window.sessionStorage.removeItem(activeWorkoutStorageKey);
}
