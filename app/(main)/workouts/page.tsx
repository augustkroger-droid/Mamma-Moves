import { WorkoutTemplateList } from "@/components/workouts/workout-template-list";

export default function WorkoutsPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Pass</p>
        <h1 className="page-title">Färdiga pass.</h1>
        <p className="page-lead">Enkla pass som senare hämtas från databasen.</p>
      </header>

      <WorkoutTemplateList />
    </div>
  );
}
