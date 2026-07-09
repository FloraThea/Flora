"use client";

import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import { accentClasses, type FloraAccent } from "@/lib/theme";
import type { SequenceCardSummary } from "../types";

const ACCENTS: FloraAccent[] = ["rose", "lavender", "sage", "peach", "cream"];

function accentForIndex(index: number): FloraAccent {
  return ACCENTS[index % ACCENTS.length];
}

type SequenceCardProps = {
  sequence: SequenceCardSummary;
  index: number;
  onClick: () => void;
};

export function SequenceCard({ sequence, index, onClick }: SequenceCardProps) {
  const accent = accentClasses[accentForIndex(index)] ?? accentClasses.lavender;

  return (
    <button type="button" onClick={onClick} className="text-left">
      <FloraCard padding="lg" hoverable className={accent.border}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <FloraBadge accent={accentForIndex(index)}>
            {sequence.sous_matiere || sequence.matiere}
          </FloraBadge>
          <FloraBadge accent="cream">P{sequence.period_number}</FloraBadge>
        </div>

        <h3 className="font-serif text-xl text-flora-text">{sequence.title}</h3>
        <p className="mt-2 text-sm font-light text-flora-text-muted">
          Semaine {sequence.week_numbers.join(", ")} · {sequence.session_count} séances
        </p>
      </FloraCard>
    </button>
  );
}
