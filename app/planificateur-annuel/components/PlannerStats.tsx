"use client";

import { FloraCard } from "@/components/ui/FloraCard";
import type { PlannerStats } from "@/lib/annual-planner/types";

type PlannerStatsProps = {
  stats: PlannerStats;
};

export function PlannerStats({ stats }: PlannerStatsProps) {
  const items = [
    { label: "Semaines réalisées", value: stats.weeksCompleted },
    { label: "Semaines restantes", value: stats.weeksRemaining },
    { label: "Heures effectuées", value: `${stats.hoursCompleted}h` },
    { label: "Compétences validées", value: stats.competencesValidated },
    { label: "Séquences en cours", value: stats.sequencesInProgress },
    { label: "Œuvres étudiées", value: stats.artworksStudied },
    { label: "Sorties réalisées", value: stats.sortiesCompleted },
  ];

  return (
    <FloraCard padding="md" accent="cream">
      <h4 className="font-serif text-lg font-medium text-flora-text">Tableau de bord</h4>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-white/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-flora-text-muted">{item.label}</p>
            <p className="font-serif text-xl font-medium text-flora-text">{item.value}</p>
          </div>
        ))}
      </div>
    </FloraCard>
  );
}
