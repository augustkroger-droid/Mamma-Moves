import { Play } from "lucide-react";

export default function IntroPage() {
  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Mamma Moves</p>
        <h1 className="page-title">Din alldeles egna traningsapp.</h1>
        <p className="page-lead">
          Valj nagra ovningar, starta ett pass och folj videorna direkt har inne.
        </p>
      </header>

      <section className="surface" style={{ padding: 16 }} aria-label="Introduktionsvideo">
        <div className="video-frame">
          <div className="video-placeholder">
            <div>
              <Play aria-hidden="true" size={38} />
              <p style={{ margin: "10px 0 0", fontWeight: 800 }}>Introvideo kommer har</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 18 }}>
        <h2 className="section-title">Sa funkar det</h2>
        <p className="muted" style={{ margin: "10px 0 0", lineHeight: 1.55 }}>
          Borja i Ovningar eller valj ett fardigt pass. Nar passet startar visar appen en
          video i taget, och du trycker vidare nar du ar klar.
        </p>
      </section>
    </div>
  );
}
