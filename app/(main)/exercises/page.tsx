import { ExerciseLibrary } from "@/components/exercises/exercise-library";

export default function ExercisesPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Övningar</p>
        <h1 className="page-title">Välj dagens moves.</h1>
        <p className="page-lead">Välj flera övningar, slumpa ordningen och starta ett eget pass.</p>
      </header>

      <ExerciseLibrary />
    </div>
  );
}
