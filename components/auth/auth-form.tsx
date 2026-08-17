"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function getPostLoginHref() {
    const nextHref = searchParams.get("next");

    if (nextHref && nextHref.startsWith("/") && !nextHref.startsWith("/login")) {
      return nextHref;
    }

    const { data } = await supabase
      .from("profiles")
      .select("has_seen_intro")
      .maybeSingle();

    return data?.has_seen_intro ? "/exercises" : "/intro";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    if (mode === "signup") {
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password, username })
      });
      const signupResult = await signupResponse.json().catch(() => null) as { error?: string } | null;

      if (!signupResponse.ok) {
        setMessage(signupResult?.error ?? "Kunde inte skapa kontot.");
        setIsLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setMessage(signInError.message);
        setIsLoading(false);
        return;
      }

      const targetHref = await getPostLoginHref();
      router.refresh();
      router.push(targetHref);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage(
        error.message.toLowerCase().includes("email not confirmed")
          ? "Kontot finns, men är inte aktiverat än."
          : error.message
      );
      setIsLoading(false);
      return;
    }

    const targetHref = await getPostLoginHref();
    router.refresh();
    router.push(targetHref);
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
      setMessage("Lösenordslänk skickad om adressen finns.");
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
          : "Skapa ett konto för att spara pass, historik och streak."}
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
