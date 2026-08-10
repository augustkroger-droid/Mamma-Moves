"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export function AuthForm() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username
          }
        }
      });

      if (error) {
        setMessage(error.message);
        setIsLoading(false);
        return;
      }

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          setMessage("Kontot skapades, men Supabase kraver fortfarande att kontot aktiveras.");
          setIsLoading(false);
          return;
        }
      }

      router.refresh();
      router.push("/intro");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage(
        error.message.toLowerCase().includes("email not confirmed")
          ? "Kontot finns, men är inte aktiverat i Supabase än."
          : error.message
      );
      setIsLoading(false);
      return;
    }

    router.refresh();
    router.push("/intro");
  }

  async function resetPassword() {
    if (!email) {
      setMessage("Skriv in din e-postadress först.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Lösenordslänk skickad om adressen finns hos Supabase.");
    }

    setIsLoading(false);
  }

  return (
    <section className="auth-card surface">
      <div className="brand-mark" aria-hidden="true">
        <Heart />
      </div>
      <p className="eyebrow">Mamma Moves</p>
      <h1 className="auth-title">{mode === "login" ? "Välkommen tillbaka." : "Skapa konto."}</h1>
      <p className="page-lead auth-lead">
        {mode === "login"
          ? "Logga in och kom direkt tillbaka till din träning."
          : "E-post, användarnamn och lösenord räcker för första versionen."}
      </p>

      <div className="segmented-control" role="tablist" aria-label="Välj auth-läge">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
        >
          Logga in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
        >
          Skapa konto
        </button>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <label>
          <span>E-post</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {mode === "signup" ? (
          <label>
            <span>Användarnamn</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={2}
            />
          </label>
        ) : null}

        <label>
          <span>Lösenord</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
          />
        </label>

        {message ? <p className="form-message">{message}</p> : null}

        <button className="button full" type="submit" disabled={isLoading}>
          {isLoading ? <Loader2 className="spin" aria-hidden="true" size={20} /> : null}
          {mode === "login" ? "Logga in" : "Skapa konto"}
        </button>

        {mode === "login" ? (
          <button className="text-button" type="button" onClick={resetPassword} disabled={isLoading}>
            Glömt lösenord?
          </button>
        ) : null}
      </form>
    </section>
  );
}
