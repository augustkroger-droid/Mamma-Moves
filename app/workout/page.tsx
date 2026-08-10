import { Suspense } from "react";
import { WorkoutPlayer } from "@/components/workouts/workout-player";

export default function WorkoutPage() {
  return (
    <Suspense fallback={<main className="workout-shell">Hämtar pass...</main>}>
      <WorkoutPlayer />
    </Suspense>
  );
}
