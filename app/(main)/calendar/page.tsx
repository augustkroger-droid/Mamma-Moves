import { TrainingCalendar } from "@/components/calendar/training-calendar";

export default function CalendarPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Kalender</p>
        <h1 className="page-title">Din historik.</h1>
        <p className="page-lead">Har syns passen som sparas nar du avslutar traningen.</p>
      </header>

      <TrainingCalendar />
    </div>
  );
}
