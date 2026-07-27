import type { SeancePhase } from "@/lib/seances/types";
import {
  PREPARATION_DEROULEMENT_STEPS,
  type DeroulementStep,
  type SessionPreparationDetail,
} from "./types";

export function emptyDeroulementSteps(): DeroulementStep[] {
  return PREPARATION_DEROULEMENT_STEPS.map((step) => ({
    key: step.key,
    label: step.label,
    content: "",
  }));
}

export function parseDeroulementSteps(value: unknown): DeroulementStep[] {
  if (!Array.isArray(value)) return emptyDeroulementSteps();
  const parsed = value
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        key: String(record.key ?? ""),
        label: String(record.label ?? ""),
        content: String(record.content ?? ""),
      };
    })
    .filter((step) => step.key && step.label);

  return parsed.length > 0 ? parsed : emptyDeroulementSteps();
}

export function parseSessionPreparationDetail(
  metadata?: Record<string, unknown>,
): SessionPreparationDetail {
  return {
    competences: Array.isArray(metadata?.competences)
      ? metadata!.competences.map(String).filter(Boolean)
      : metadata?.competenceBo
        ? [String(metadata.competenceBo)]
        : [],
    referentielIds: Array.isArray(metadata?.referentielIds)
      ? metadata!.referentielIds.map(String).filter(Boolean)
      : [],
    deroulement: parseDeroulementSteps(metadata?.deroulement),
    materiel: Array.isArray(metadata?.materiel)
      ? metadata!.materiel.map(String).filter(Boolean)
      : [],
    resources: Array.isArray(metadata?.resources)
      ? metadata!.resources.map(String).filter(Boolean)
      : [],
    resourceIds: Array.isArray(metadata?.resourceIds)
      ? metadata!.resourceIds.map(String).filter(Boolean)
      : [],
  };
}

export function serializeSessionPreparationDetail(
  detail: SessionPreparationDetail,
): Record<string, unknown> {
  return {
    competences: detail.competences,
    referentielIds: detail.referentielIds,
    competenceBo: detail.competences[0] ?? "",
    deroulement: detail.deroulement.filter((step) => step.content.trim()),
    materiel: detail.materiel,
    resources: detail.resources,
    resourceIds: detail.resourceIds,
  };
}

export function deroulementSummary(steps: DeroulementStep[]): string {
  return steps
    .filter((step) => step.content.trim())
    .map((step) => `${step.label} : ${step.content.trim()}`)
    .join("\n\n");
}

const PHASE_KEY_BY_STEP: Record<string, SeancePhase["phaseKey"]> = {
  mise_en_situation: "accueil",
  recherche: "recherche",
  mise_en_commun: "mise_en_commun",
  entrainement: "entrainement",
  institutionnalisation: "institutionnalisation",
  reinvestissement: "reinvestissement",
};

export function buildPhasesFromDeroulement(
  steps: DeroulementStep[],
  dureeMinutes: number,
): SeancePhase[] {
  const filled = steps.filter((step) => step.content.trim());
  if (filled.length === 0) return [];

  const stepDuration = Math.max(5, Math.round(dureeMinutes / filled.length));

  return filled.map((step, index) => ({
    phaseKey: PHASE_KEY_BY_STEP[step.key] ?? "entrainement",
    title: step.label,
    sortOrder: index,
    dureeMinutes: stepDuration,
    summary: step.content.trim(),
    activities: [
      {
        sortOrder: 0,
        objectif: "",
        consignesEnseignant: step.content.trim(),
        consignesEleves: "",
        organisation: "",
        dureeMinutes: stepDuration,
        variablesPedagogiques: [],
        questions: [],
        reponsesAttendues: [],
        erreursFrequentes: [],
        remediations: [],
      },
    ],
  }));
}

export function buildSessionDetailFromProgressionRow(input: {
  competenceBo?: string;
  objectifs?: string[];
  deroulement?: string;
  materiel?: string[];
  resources?: string[];
  referentielIds?: string[];
}): SessionPreparationDetail {
  const objectif = input.objectifs?.[0]?.trim() ?? "";
  const extraObjectifs = input.objectifs?.slice(1).filter(Boolean) ?? [];
  const deroulementContent = [input.deroulement?.trim(), ...extraObjectifs].filter(Boolean).join("\n\n");

  const steps = emptyDeroulementSteps();
  if (deroulementContent) {
    steps[0] = { ...steps[0]!, content: deroulementContent };
  }

  return {
    competences: input.competenceBo ? [input.competenceBo] : [],
    referentielIds: input.referentielIds ?? [],
    deroulement: steps,
    materiel: input.materiel ?? [],
    resources: input.resources ?? [],
    resourceIds: [],
  };
}
