import { WorkoutTemplateList } from "@/components/workouts/workout-template-list";

export default function WorkoutsPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Pass</p>
        <h1 className="page-title">Dina pass.</h1>
        <p className="page-lead">Välj ett färdigt pass eller skapa ett eget.</p>
      </header>

      <WorkoutTemplateList />
    </div>
  );
}
