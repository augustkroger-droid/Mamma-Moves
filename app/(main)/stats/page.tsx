import { StatsOverview } from "@/components/stats/stats-overview";

export default function StatsPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Statistik</p>
        <h1 className="page-title">Lagom mycket siffror.</h1>
        <p className="page-lead">En enkel vy för framsteg, streak och träningsvanor.</p>
      </header>

      <StatsOverview />
    </div>
  );
}
