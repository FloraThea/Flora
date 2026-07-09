"use client";

import type { PlannerCompetenceStatus, PlannerSubjectHours } from "@/lib/annual-planner/types";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";

type AnnualProgressProps = {
  view: string;
  annualProgressPercent: number;
  competences: PlannerCompetenceStatus[];
  subjectHours: PlannerSubjectHours[];
};

export function AnnualProgress({
  view,
  annualProgressPercent,
  competences,
  subjectHours,
}: AnnualProgressProps) {
  if (view === "competencies") {
    const done = competences.filter((item) => item.status === "done");
    const missing = competences.filter((item) => item.status === "missing");

    return (
      <FloraCard padding="lg" accent="lavender">
        <h3 className="font-serif text-xl font-medium text-flora-text">Vue Compétences</h3>
        <div className="mt-4 mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-flora-text-muted">Avancement annuel</span>
            <span className="font-medium text-flora-text">{annualProgressPercent}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sauge-light to-sauge"
              style={{ width: `${annualProgressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-flora-text-muted">Travaillées</p>
            <div className="flex flex-wrap gap-1">
              {done.slice(0, 12).map((item) => (
                <FloraBadge key={item.id} accent="sage">
                  {item.label.slice(0, 24)}
                </FloraBadge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-flora-text-muted">Restantes</p>
            <p className="text-sm text-flora-text-muted">
              {Math.max(competences.length - done.length, 0)} compétence(s)
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-flora-text-muted">Jamais programmées</p>
            {missing.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {missing.map((item) => (
                  <FloraBadge key={item.id} accent="rose">
                    {item.label.slice(0, 24)}
                  </FloraBadge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-flora-text-muted">Aucune compétence BO oubliée détectée.</p>
            )}
          </div>
        </div>
      </FloraCard>
    );
  }

  if (view === "hours") {
    return (
      <FloraCard padding="lg" accent="cream">
        <h3 className="font-serif text-xl font-medium text-flora-text">Vue Horaires</h3>
        <div className="mt-4 space-y-3">
          {subjectHours.map((row) => (
            <div key={row.subject} className="rounded-2xl bg-white/50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <FloraBadge accent={row.accent}>{row.subject}</FloraBadge>
                <span className="text-xs text-flora-text-muted">
                  {row.planned} / {row.target} sem.
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/70">
                <div
                  className={`h-full rounded-full ${
                    row.delta > 0 ? "bg-rose-soft" : row.delta < 0 ? "bg-peche-light" : "bg-sauge-light"
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((row.planned / Math.max(row.target, 1)) * 100))}%`,
                  }}
                />
              </div>
              {row.delta !== 0 ? (
                <p className="mt-1 text-xs text-flora-text-muted">
                  {row.delta > 0 ? "Dépassement" : "Écart"} : {Math.abs(row.delta)} semaine(s)
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </FloraCard>
    );
  }

  return null;
}
