"use client";

import { useCallback, useEffect, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import type { MigrationEntry, MigrationStatus } from "@/lib/db/migrations/types";

type MigrationsApiResponse = MigrationStatus & {
  adminAuthHint?: string | null;
  ok?: boolean;
  error?: string;
  applied?: string[];
  skipped?: string[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function MigrationRow({ entry }: { entry: MigrationEntry }) {
  const pending = entry.status === "pending";

  return (
    <li className="flex flex-col gap-1 border-b border-sauge-light/30 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-flora-text sm:text-sm">{entry.name}</p>
        {entry.appliedAt && (
          <p className="text-xs font-light text-flora-text-muted">Appliquée le {formatDate(entry.appliedAt)}</p>
        )}
      </div>
      <FloraBadge accent={pending ? "peach" : "sage"} className="w-fit shrink-0">
        {pending ? "En attente" : "Appliquée"}
      </FloraBadge>
    </li>
  );
}

export function AdministrationPage() {
  const [status, setStatus] = useState<MigrationsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/migrations");
      const data = (await response.json()) as MigrationsApiResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Impossible de charger l'état des migrations.");
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleApply() {
    setApplying(true);
    setMessage(null);
    setError(null);

    try {
      const headers: HeadersInit = {};
      if (adminSecret.trim()) {
        headers["x-flora-admin-secret"] = adminSecret.trim();
      }

      const response = await fetch("/api/admin/migrations", {
        method: "POST",
        headers,
      });
      const data = (await response.json()) as MigrationsApiResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Échec de l'application des migrations.");
      }

      const appliedCount = data.applied?.length ?? 0;
      if (appliedCount > 0) {
        setMessage(`${appliedCount} migration(s) appliquée(s) avec succès.`);
      } else {
        setMessage("Aucune migration en attente — la base est déjà à jour.");
      }

      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setApplying(false);
    }
  }

  const pendingCount = status?.pendingCount ?? 0;
  const configured = status?.configured ?? false;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <FloraPageTitle
        title="Administration"
        subtitle="Gestion de la base de données Supabase — sans CLI Supabase."
      />

      <FloraCard className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-serif text-xl font-light text-flora-text">Migrations SQL</h2>
            <p className="mt-1 text-sm font-light text-flora-text-muted">
              Flora applique automatiquement les fichiers SQL de{" "}
              <code className="rounded bg-white/60 px-1.5 py-0.5 text-xs">supabase/migrations/</code> au démarrage
              lorsque la connexion Postgres est configurée.
            </p>
          </div>
          <FloraButton
            variant="primary"
            accent="rose"
            onClick={() => void handleApply()}
            disabled={!configured || applying || loading}
          >
            {applying ? "Application…" : "Appliquer les migrations"}
          </FloraButton>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/45 px-4 py-3">
            <p className="text-xs font-light text-flora-text-muted">Connexion Postgres</p>
            <p className="mt-1 text-sm text-flora-text">
              {configured ? (status?.databaseHost ?? "Configurée") : "Non configurée"}
            </p>
          </div>
          <div className="rounded-2xl bg-white/45 px-4 py-3">
            <p className="text-xs font-light text-flora-text-muted">Appliquées</p>
            <p className="mt-1 text-sm text-flora-text">{status?.appliedCount ?? "—"}</p>
          </div>
          <div className="rounded-2xl bg-white/45 px-4 py-3">
            <p className="text-xs font-light text-flora-text-muted">En attente</p>
            <p className="mt-1 text-sm text-flora-text">{loading ? "…" : pendingCount}</p>
          </div>
        </div>

        {!configured && status?.configurationHint && (
          <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm font-light text-amber-900">
            {status.configurationHint}
          </div>
        )}

        {status?.adminAuthHint && (
          <div className="mb-6">
            <label htmlFor="admin-secret" className="mb-2 block text-sm font-light text-flora-text-muted">
              Secret d&apos;administration (FLORA_ADMIN_SECRET)
            </label>
            <input
              id="admin-secret"
              type="password"
              value={adminSecret}
              onChange={(event) => setAdminSecret(event.target.value)}
              placeholder="Optionnel en développement local"
              className="w-full max-w-md rounded-2xl border border-sauge-light/50 bg-white/70 px-4 py-2.5 text-sm font-light text-flora-text outline-none focus:border-rose-poudre/60"
            />
            <p className="mt-1 text-xs font-light text-flora-text-muted">{status.adminAuthHint}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm font-light text-emerald-900">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/70 px-4 py-3 text-sm font-light text-rose-900">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-sauge-light/40 bg-white/35">
          {loading ? (
            <p className="px-4 py-6 text-sm font-light text-flora-text-muted">Chargement…</p>
          ) : status?.entries.length ? (
            <ul>{status.entries.map((entry) => <MigrationRow key={entry.name} entry={entry} />)}</ul>
          ) : (
            <p className="px-4 py-6 text-sm font-light text-flora-text-muted">Aucun fichier de migration trouvé.</p>
          )}
        </div>
      </FloraCard>

      <FloraCard className="p-6">
        <h2 className="font-serif text-xl font-light text-flora-text">Configuration requise</h2>
        <p className="mt-2 text-sm font-light text-flora-text-muted">
          Copiez la chaîne de connexion directe depuis Supabase → Project Settings → Database → Connection string
          (URI, mode direct, port 5432) dans votre fichier <code className="text-xs">.env.local</code> :
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-sauge-sidebar/90 p-4 text-xs text-white/90">
{`SUPABASE_DATABASE_URL=postgresql://postgres:[MOT_DE_PASSE]@db.[REF].supabase.co:5432/postgres

# Optionnel — secret pour le bouton en production
FLORA_ADMIN_SECRET=votre-secret

# Optionnel — désactiver l'application automatique au démarrage
FLORA_AUTO_MIGRATE=false`}
        </pre>
      </FloraCard>
    </div>
  );
}
