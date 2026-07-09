import type { SeanceCardSummary, SeanceViewMode, SequenceSessionOption, SequenceWithSeancesSummary } from "@/lib/seances/types";

export type SeancesFormValues = {
  sequenceId: string;
};

export const initialSeancesFormValues: SeancesFormValues = {
  sequenceId: "",
};

export type { SeanceCardSummary, SeanceViewMode, SequenceSessionOption, SequenceWithSeancesSummary };

export const VIEW_MODE_OPTIONS: { value: SeanceViewMode; label: string }[] = [
  { value: "cards", label: "Cartes" },
  { value: "list", label: "Liste" },
  { value: "chrono", label: "Chronologique" },
  { value: "sequence", label: "Séquence" },
  { value: "matiere", label: "Matière" },
  { value: "week", label: "Semaine" },
];
