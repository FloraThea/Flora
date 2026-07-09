import type { ValidatedProgressionSummary } from "@/lib/sequences/types";

export type SequencesFormValues = {
  progressionId: string;
};

export const initialSequencesFormValues: SequencesFormValues = {
  progressionId: "",
};

export type ProgressionRowOption = {
  id: string;
  tabId: string;
  subjectLabel: string;
  subSubjectLabel: string;
  periodNumber: number;
  weekNumber: number;
  seanceLabel: string;
  competenceBo: string;
  sequenceModule: string;
  hasSequence: boolean;
};

export type SequenceCardSummary = {
  id: string;
  title: string;
  matiere: string;
  sous_matiere: string;
  period_number: number;
  week_numbers: number[];
  session_count: number;
  progression_row_id: string;
  status: string;
};

export type { ValidatedProgressionSummary };
