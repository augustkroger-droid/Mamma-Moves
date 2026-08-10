import { TrainingCalendar } from "@/components/calendar/training-calendar";

export default function CalendarPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Kalender</p>
        <h1 className="page-title">Din historik.</h1>
        <p className="page-lead">Se vad du har tränat och fortsätt pass som inte blev klara.</p>
      </header>

      <TrainingCalendar />
    </div>
  );
}
