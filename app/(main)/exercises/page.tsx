import Link from "next/link";
import { Plus } from "lucide-react";
import { ExerciseLibrary } from "@/components/exercises/exercise-library";

export default function ExercisesPage() {
  return (
    <div className="screen-stack">
      <header className="page-header-with-action">
        <div>
          <p className="eyebrow">Övningar</p>
          <h1 className="page-title">Välj dagens moves.</h1>
          <p className="page-lead">Välj flera övningar, slumpa ordningen och starta ett eget pass.</p>
        </div>
        <Link className="button secondary page-header-action" href="/exercises/new">
          <Plus aria-hidden="true" size={18} />
          Lägg till övning
        </Link>
      </header>

      <ExerciseLibrary />
    </div>
  );
}
