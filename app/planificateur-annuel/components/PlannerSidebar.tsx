"use client";

import Link from "next/link";
import { FloraCard } from "@/components/ui/FloraCard";
import type { PlannerSuggestion, PlannerWeek } from "@/lib/annual-planner/types";

type PlannerSidebarProps = {
  selectedWeek: PlannerWeek | null;
  suggestions: PlannerSuggestion[];
};

export function PlannerSidebar({ selectedWeek, suggestions }: PlannerSidebarProps) {
  return (
    <aside className="flex flex-col gap-4">
      <FloraCard padding="md" accent="sage">
        <h4 className="font-serif text-lg font-medium text-flora-text">Semaine sélectionnée</h4>
        {selectedWeek ? (
          <div className="mt-3 space-y-2 text-sm font-light text-flora-text-muted">
            <p>
              <strong className="text-flora-text">Semaine {selectedWeek.weekNumberInYear}</strong>
              <br />
              {selectedWeek.periodLabel}
            </p>
            <p>{selectedWeek.classDays} jours de classe</p>
            {selectedWeek.sessions.length > 0 ? (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-flora-text-subtle">Séances</p>
                <ul className="space-y-1">
                  {selectedWeek.sessions.map((session) => (
                    <li key={session.id}>
                      <Link href={session.href} className="text-flora-text hover:underline">
                        {session.subjectLabel} — {session.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {selectedWeek.artwork ? (
              <div className="rounded-2xl bg-white/50 p-3">
                <p className="text-xs uppercase tracking-wide text-flora-text-subtle">Œuvre</p>
                <p className="font-medium text-flora-text">{selectedWeek.artwork.title}</p>
                {selectedWeek.artwork.artist ? <p>{selectedWeek.artwork.artist}</p> : null}
              </div>
            ) : null}
            <Link
              href={`/cahier-journal?week=${selectedWeek.weekNumberInYear}`}
              className="inline-block text-sm text-sauge-strong hover:underline"
            >
              Ouvrir le cahier journal →
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm font-light text-flora-text-muted">
            Cliquez sur une semaine pour voir le détail des journées, séances, rituels et compétences.
          </p>
        )}
      </FloraCard>

      {suggestions.length > 0 ? (
        <FloraCard padding="md" accent="lavender">
          <h4 className="font-serif text-lg font-medium text-flora-text">Suggestions Théa</h4>
          <ul className="mt-3 space-y-2">
            {suggestions.slice(0, 5).map((item) => (
              <li
                key={item.id}
                className={`rounded-2xl px-3 py-2 text-xs font-light ${
                  item.severity === "alert"
                    ? "bg-rose-soft/30 text-[#b88989]"
                    : item.severity === "warning"
                      ? "bg-peche-light/40 text-[#c49a88]"
                      : "bg-white/50 text-flora-text-muted"
                }`}
              >
                {item.message}
              </li>
            ))}
          </ul>
        </FloraCard>
      ) : null}
    </aside>
  );
}
