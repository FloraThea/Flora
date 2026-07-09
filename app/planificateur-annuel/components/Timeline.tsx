"use client";

import type { PlannerTimelineMarker } from "@/lib/annual-planner/types";
import { FloraBadge } from "@/components/ui/FloraBadge";

type TimelineProps = {
  markers: PlannerTimelineMarker[];
};

const KIND_LABELS: Record<PlannerTimelineMarker["kind"], string> = {
  rentree: "Rentrée",
  vacation: "Vacances",
  holiday: "Férié",
  sortie: "Sortie",
  evaluation: "Évaluation",
  project: "Projet",
  conseil: "Conseil",
  fete: "Fête",
};

export function Timeline({ markers }: TimelineProps) {
  if (markers.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-white/60 bg-white/45 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg font-medium text-flora-text">Frise chronologique</h3>
        <span className="text-xs font-light text-flora-text-muted">{markers.length} repères</span>
      </div>

      <div className="relative overflow-x-auto pb-2">
        <div className="absolute top-5 right-8 left-8 h-px bg-gradient-to-r from-sauge-light/50 via-lavande-light/40 to-rose-soft/50" />
        <div className="flex min-w-max gap-3 px-2">
          {markers.map((marker) => (
            <div
              key={marker.id}
              className="relative z-[1] flex w-28 shrink-0 flex-col items-center gap-2 text-center"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm">
                <FloraBadge accent={marker.accent} className="text-[10px]">
                  {KIND_LABELS[marker.kind].slice(0, 3)}
                </FloraBadge>
              </span>
              <div>
                <p className="line-clamp-2 text-[10px] font-medium text-flora-text">{marker.label}</p>
                <p className="text-[10px] text-flora-text-muted">
                  {new Date(marker.date).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
