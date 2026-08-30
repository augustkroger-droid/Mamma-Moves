type ExerciseWithCategories = {
  category?: string | null;
  categories?: string[] | null;
};

export const defaultExerciseCategories = ["Kondition", "Skelett"];

export function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function exerciseCategories(exercise: ExerciseWithCategories) {
  const categories = exercise.categories?.length
    ? exercise.categories
    : exercise.category
      ? [exercise.category]
      : [];

  return categories
    .map(normalizeCategoryName)
    .filter(Boolean);
}

export function formatExerciseCategories(exercise: ExerciseWithCategories) {
  const categories = exerciseCategories(exercise);
  return categories.length > 0 ? categories.join(", ") : "Övning";
}

export function collectExerciseCategoryOptions(exercises: ExerciseWithCategories[]) {
  return [
    ...new Set(
      [...defaultExerciseCategories, ...exercises.flatMap((exercise) => exerciseCategories(exercise))]
    )
  ].sort((first, second) => first.localeCompare(second, "sv-SE"));
}
