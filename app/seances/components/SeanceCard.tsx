import { FloraBadge } from "@/components/ui/FloraBadge";
import type { SeanceCardSummary } from "@/lib/seances/types";

type SeanceCardProps = {
  seance: SeanceCardSummary;
  index: number;
  onClick: () => void;
};

const accents = ["rose", "lavender", "sage", "peach", "cream"] as const;

export function SeanceCard({ seance, index, onClick }: SeanceCardProps) {
  const accent = accents[index % accents.length];

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border border-white/70 bg-white/55 p-5 text-left backdrop-blur-sm transition hover:bg-white/75"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <FloraBadge accent={accent}>Séance {seance.sessionNumber}</FloraBadge>
        <FloraBadge accent="cream">
          P{seance.periodNumber} · S{seance.weekNumber}
        </FloraBadge>
        <FloraBadge accent="sage">{seance.dureeMinutes} min</FloraBadge>
      </div>
      <h3 className="font-serif text-xl text-flora-text">{seance.title}</h3>
      <p className="mt-2 text-sm font-light text-flora-text-muted">
        {seance.matiere} · {seance.sousMatiere} · {seance.niveau}
      </p>
    </button>
  );
}
