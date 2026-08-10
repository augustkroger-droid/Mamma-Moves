"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Play } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function IntroContent() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function completeIntro() {
    setIsSaving(true);
    setMessage(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setMessage("Kunde inte hitta inloggad användare.");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        has_seen_intro: true,
        intro_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", userData.user.id);

    if (error) {
      setMessage(error.message);
      setIsSaving(false);
      return;
    }

    router.push("/exercises");
  }

  return (
    <div className="screen-stack">
      <header>
        <p className="eyebrow">Mamma Moves</p>
        <h1 className="page-title">Din alldeles egna träningsapp.</h1>
        <p className="page-lead">
          Välj några övningar, starta ett pass och följ videorna direkt här inne.
        </p>
      </header>

      <section className="surface" style={{ padding: 16 }} aria-label="Introduktionsvideo">
        <div className="video-frame">
          <div className="video-placeholder">
            <div>
              <Play aria-hidden="true" size={38} />
              <p style={{ margin: "10px 0 0", fontWeight: 800 }}>Introvideo kommer här</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card intro-card">
        <h2 className="section-title">Så funkar det</h2>
        <p className="muted">
          Börja i Övningar eller välj ett färdigt pass. När passet startar visar appen en
          video i taget, och du trycker vidare när du är klar.
        </p>
        {message ? <p className="form-message">{message}</p> : null}
        <button className="button full" type="button" onClick={completeIntro} disabled={isSaving}>
          {isSaving ? <Loader2 className="spin" aria-hidden="true" size={20} /> : null}
          Kom igång
          {!isSaving ? <ArrowRight aria-hidden="true" size={20} /> : null}
        </button>
      </section>
    </div>
  );
}
