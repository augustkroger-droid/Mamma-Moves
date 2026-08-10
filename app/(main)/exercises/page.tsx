import { ExerciseLibrary } from "@/components/exercises/exercise-library";

export default function ExercisesPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Ovningar</p>
        <h1 className="page-title">Välj dagens moves.</h1>
        <p className="page-lead">Valj flera ovningar och skapa ett forsta slumpat pass.</p>
      </header>

      <ExerciseLibrary />
    </div>
  );
}
