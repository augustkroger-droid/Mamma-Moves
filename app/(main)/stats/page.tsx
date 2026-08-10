import { StatsOverview } from "@/components/stats/stats-overview";

export default function StatsPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Statistik</p>
        <h1 className="page-title">Lagom mycket siffror.</h1>
        <p className="page-lead">En varm och enkel vy for framsteg, utan att det blir ett kontrollrum.</p>
      </header>

      <StatsOverview />
    </div>
  );
}
