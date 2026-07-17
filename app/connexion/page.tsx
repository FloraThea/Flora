"use client";

import { useState } from "react";
import Link from "next/link";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { supabase } from "@/lib/supabase";
import { inputClassName, labelClassName } from "@/app/profil/types";

export default function ConnexionPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const authResult =
        mode === "sign_in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (authResult.error) throw authResult.error;
      const session = authResult.data.session;
      if (!session?.access_token) {
        setMessage("Compte créé. Vérifiez votre e-mail si la confirmation est activée.");
        return;
      }

      const linkResponse = await fetch("/api/auth/link-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        }),
      });

      const linkData = (await linkResponse.json()) as { error?: string };
      if (!linkResponse.ok) {
        throw new Error(linkData.error ?? "Impossible de lier le profil enseignant.");
      }

      window.location.href = "/profil";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <FloraPageTitle
        title="Connexion Flora"
        subtitle="Liez votre compte à votre profil pédagogique pour isoler vos données."
      />

      <FloraCard padding="lg" accent="sage" className="mt-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className={labelClassName} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClassName}
              autoComplete="email"
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            />
          </div>

          {error && <p className="text-sm text-rose-700">{error}</p>}
          {message && <p className="text-sm text-flora-text-muted">{message}</p>}

          <div className="flex flex-wrap gap-2">
            <FloraButton type="submit" disabled={loading}>
              {loading ? "Connexion…" : mode === "sign_in" ? "Se connecter" : "Créer un compte"}
            </FloraButton>
            <FloraButton
              type="button"
              variant="secondary"
              onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
            >
              {mode === "sign_in" ? "Créer un compte" : "Déjà un compte ?"}
            </FloraButton>
          </div>
        </form>

        <p className="mt-4 text-xs font-light text-flora-text-muted">
          Sans connexion, Flora reste en mode single-tenant (premier profil).{" "}
          <Link href="/" className="underline">
            Retour à l&apos;accueil
          </Link>
        </p>
      </FloraCard>
    </main>
  );
}
