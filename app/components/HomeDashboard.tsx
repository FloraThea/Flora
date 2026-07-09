"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraDashboardCard } from "@/components/ui/FloraDashboardCard";
import { TheaHeroPanel } from "@/components/ui/TheaGlow";
import { FloraProgressBar } from "@/components/ui/FloraProgressBar";

type DashboardSummary = {
  profileComplete: boolean;
  missingFields: string[];
  prenom: string;
  levels: string[];
  schoolYear: string;
  seancesToday: number;
  documentsCount: number;
  programmationsCount: number;
  boDocumentsCount: number;
};

function todayLabel(): string {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function HomeDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/dashboard/summary");
        const data = (await response.json()) as DashboardSummary;
        setSummary(data);
      } catch {
        setSummary(null);
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const greeting = useMemo(() => {
    if (summary?.prenom) return `Bonjour ${summary.prenom}`;
    return "Bonjour";
  }, [summary?.prenom]);

  const levelLabel =
    summary?.levels?.length ? summary.levels.join(" · ") : "Votre classe";

  return (
    <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
      <div className="min-w-0 flex-1">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-3xl font-medium tracking-tight text-flora-text sm:text-4xl">
              {greeting}
              <span aria-hidden className="text-2xl">
                🌿
              </span>
            </h2>
            <p className="mt-2 text-base font-light text-flora-text-muted">
              Voici votre espace du jour.
            </p>
            <p className="mt-1 text-sm font-light text-flora-text-subtle">
              {isLoading ? "Chargement…" : capitalize(todayLabel())}
              {summary?.schoolYear ? ` · ${summary.schoolYear}` : ""}
            </p>
          </div>

          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-[1.25rem] border border-white/80 bg-white px-4 py-2.5 text-sm font-light text-flora-text shadow-[var(--shadow-card)]"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
              <path
                d="M10 4a5 5 0 0 1 5 5v1.5l1 1.5H4l1-1.5V9a5 5 0 0 1 5-5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
            Notifications
          </button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <FloraDashboardCard
            title="Aujourd'hui"
            value={capitalize(todayLabel())}
            detail={levelLabel}
            href="/agenda"
            actionLabel="Voir mon agenda"
            icon={
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            }
          />
          <FloraDashboardCard
            title="Séances du jour"
            value={`${summary?.seancesToday ?? 0} séance${(summary?.seancesToday ?? 0) > 1 ? "s" : ""}`}
            detail="Préparées dans Flora"
            href="/seances"
            actionLabel="Voir mes séances"
            accent="sage"
            icon={
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M4 5h12M4 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          />
          <FloraDashboardCard
            title="Tâches"
            value={summary?.profileComplete ? "Profil à jour" : "Profil à compléter"}
            detail={
              summary?.missingFields?.length
                ? summary.missingFields.join(", ")
                : "Rien d'urgent pour le moment"
            }
            href="/profil"
            actionLabel="Voir mes tâches"
            accent="lavender"
            icon={
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path d="M5 10l3 3 7-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          />
          <FloraDashboardCard
            title="108h réalisées"
            value="58h sur 108h"
            detail="Suivi des heures pédagogiques"
            href="/cahier-journal"
            actionLabel="Voir le suivi"
            accent="peach"
            icon={
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            }
          />
          <FloraDashboardCard
            title="Documents du jour"
            value={`${summary?.documentsCount ?? 0} ressource${(summary?.documentsCount ?? 0) > 1 ? "s" : ""}`}
            detail={`${summary?.boDocumentsCount ?? 0} référentiel(s) BO`}
            href="/bibliotheque"
            actionLabel="Ouvrir la bibliothèque"
            icon={
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path
                  d="M4 4h8l4 4v9H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            }
          />
          <FloraDashboardCard
            title="Élèves"
            value={levelLabel}
            detail={`${summary?.programmationsCount ?? 0} programmation(s)`}
            href="/profil"
            actionLabel="Voir ma classe"
            accent="sage"
            icon={
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <circle cx="10" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4 17c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            }
          />
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <FloraCard variant="white" padding="lg">
            <h3 className="font-serif text-xl font-medium text-flora-text">Mon emploi du temps</h3>
            <ul className="mt-5 space-y-4">
              {[
                { time: "08:30", label: "Français", accent: "rose" as const },
                { time: "10:15", label: "Mathématiques", accent: "sage" as const },
                { time: "14:00", label: "Questionner le monde", accent: "lavender" as const },
              ].map((slot) => (
                <li key={slot.time} className="flex items-center gap-4 text-sm font-light">
                  <span className="w-12 shrink-0 text-flora-text-subtle">{slot.time}</span>
                  <span className="h-2 w-2 rounded-full bg-rose-poudre" />
                  <span className="text-flora-text">{slot.label}</span>
                </li>
              ))}
            </ul>
            <Link href="/emploi-du-temps" className="mt-6 inline-block">
              <FloraButton accent="sage" variant="outline" size="sm">
                Voir l&apos;emploi du temps
              </FloraButton>
            </Link>
          </FloraCard>

          <FloraCard variant="white" padding="lg">
            <h3 className="font-serif text-xl font-medium text-flora-text">Suivi des 108h</h3>
            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative mx-auto flex h-28 w-28 shrink-0 items-center justify-center sm:mx-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#fdecec" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#4a6752"
                    strokeWidth="3"
                    strokeDasharray={`${(58 / 108) * 97.4} 97.4`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <p className="font-serif text-lg font-medium text-flora-text">58h</p>
                  <p className="text-[10px] font-light text-flora-text-subtle">sur 108h</p>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-xs font-light text-flora-text-muted">
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sauge" /> APC — 18h
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-poudre" /> Animations — 12h
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-lavande" /> Réunions — 8h
                </p>
                <p className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-peche" /> Autres — 20h
                </p>
              </div>
            </div>
            <div className="mt-5">
              <FloraProgressBar value={Math.round((58 / 108) * 100)} accent="sage" size="sm" />
            </div>
            <Link href="/cahier-journal" className="mt-6 inline-block">
              <FloraButton accent="sage" variant="outline" size="sm">
                Ajouter une activité
              </FloraButton>
            </Link>
          </FloraCard>
        </div>
      </div>

      <aside className="w-full shrink-0 xl:w-[320px]">
        <TheaHeroPanel className="sticky top-8" />
      </aside>
    </div>
  );
}
