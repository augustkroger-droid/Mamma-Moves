import { ArrowRight } from "lucide-react";

const workouts = [
  { name: "Morgonpasset", meta: "6 övningar · ca 10 min" },
  { name: "Ben & rumpa", meta: "8 övningar" },
  { name: "Lugn träning", meta: "5 övningar" }
];

export default function WorkoutsPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Pass</p>
        <h1 className="page-title">Färdiga pass.</h1>
        <p className="page-lead">Enkla pass som senare hämtas från databasen.</p>
      </header>

      <section className="screen-stack" aria-label="Färdiga pass">
        {workouts.map((workout) => (
          <article key={workout.name} className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <h2 className="section-title">{workout.name}</h2>
                <p className="muted" style={{ margin: "6px 0 0" }}>{workout.meta}</p>
              </div>
              <button className="button secondary" type="button" title={`Oppna ${workout.name}`}>
                <ArrowRight aria-hidden="true" size={20} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
