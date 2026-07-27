import {
  buildPhasesFromDeroulement,
  deroulementSummary,
  parseDeroulementSteps,
  parseSessionPreparationDetail,
  serializeSessionPreparationDetail,
} from "./deroulement-utils";
import type { SeancePreparationFormValues, SequencePreparationFormValues } from "./types";
import type { IndependentSeanceCreateInput } from "@/lib/seances/types";
import type { IndependentSequenceCreateInput, SequencePayload, SequenceSession } from "@/lib/sequences/types";
import type { SeancePayload } from "@/lib/seances/types";

export function mapSeanceFormToCreateInput(
  values: SeancePreparationFormValues,
): IndependentSeanceCreateInput & {
  referentielIds: string[];
  resourceIds: string[];
  deroulement: SeancePreparationFormValues["deroulement"];
} {
  return {
    title: values.title.trim(),
    matiere: values.matiere.trim(),
    sousMatiere: values.sousMatiere.trim(),
    niveau: values.niveau.trim(),
    cycle: values.cycle.trim(),
    sessionDate: values.sessionDate || null,
    dureeMinutes: values.dureeMinutes,
    competenceBo: values.competences[0] ?? "",
    competences: values.competences,
    objectif: values.objectif.trim(),
    materiel: values.materiel,
    resources: values.resources,
    referentielIds: values.referentielIds,
    resourceIds: values.resourceIds,
    deroulement: values.deroulement,
  };
}

export function mapSequenceFormToCreateInput(
  values: SequencePreparationFormValues,
): IndependentSequenceCreateInput {
  return {
    title: values.title.trim(),
    matiere: values.matiere.trim(),
    sousMatiere: values.sousMatiere.trim(),
    niveau: values.niveau.trim(),
    cycle: values.cycle.trim(),
    competenceBo: values.competences[0] ?? "",
    attendus: values.competences,
    objectifs: values.objectifGeneral.trim() ? [values.objectifGeneral.trim()] : [],
    materiel: values.materiel,
    resources: values.resources,
    referentielIds: values.referentielIds,
    resourceIds: values.resourceIds,
    sessionCount: values.sessions.length,
    deroulementGeneral: values.deroulementGeneral,
    sessions: values.sessions.map((session) => ({
      title: session.title.trim(),
      objectif: session.objectif.trim(),
      dureeMinutes: session.dureeMinutes,
      competences: session.competences,
      referentielIds: session.referentielIds,
      deroulement: session.deroulement,
      materiel: session.materiel,
      resources: session.resources,
      resourceIds: session.resourceIds,
    })),
  };
}

export function buildSeancePhasesFromFormInput(input: {
  deroulement: SeancePreparationFormValues["deroulement"];
  dureeMinutes: number;
}) {
  const phases = buildPhasesFromDeroulement(input.deroulement, input.dureeMinutes);
  return phases.length > 0 ? phases : undefined;
}

export function mapSequenceSessionsFromForm(
  sessions: SequencePreparationFormValues["sessions"],
): SequenceSession[] {
  return sessions.map((session, index) => ({
    sessionNumber: index + 1,
    title: session.title,
    objectif: session.objectif,
    dureeMinutes: session.dureeMinutes,
    ordrePedagogique: index + 1,
    placeProgression: "",
    metadata: serializeSessionPreparationDetail({
      competences: session.competences,
      referentielIds: session.referentielIds,
      deroulement: session.deroulement,
      materiel: session.materiel,
      resources: session.resources,
      resourceIds: session.resourceIds,
    }),
  }));
}

export function sequenceDeroulementGeneralSummary(
  steps: SequencePreparationFormValues["deroulementGeneral"],
): string {
  return deroulementSummary(steps);
}

export function mapSequencePayloadToFormValues(payload: SequencePayload): SequencePreparationFormValues {
  const metadata = payload.sequence.metadata ?? {};
  return {
    title: payload.sequence.title,
    matiere: payload.sequence.matiere,
    sousMatiere: payload.sequence.sousMatiere,
    niveau: payload.sequence.niveau,
    cycle: payload.sequence.cycle,
    competences:
      (Array.isArray(metadata.competences) ? metadata.competences.map(String) : null) ??
      payload.sequence.attendus ??
      (payload.sequence.competenceBo ? [payload.sequence.competenceBo] : []),
    referentielIds: payload.sequence.referentielIds,
    objectifGeneral: payload.sequence.objectifs[0] ?? "",
    deroulementGeneral: parseDeroulementSteps(metadata.deroulementGeneral),
    materiel: payload.sequence.materiel,
    resources: payload.sequence.resources,
    resourceIds: payload.sequence.resourceIds,
    sessions: payload.sessions.map((session) => {
      const detail = parseSessionPreparationDetail(session.metadata);
      return {
        sessionNumber: session.sessionNumber,
        title: session.title,
        objectif: session.objectif,
        dureeMinutes: session.dureeMinutes,
        competences: detail.competences,
        referentielIds: detail.referentielIds,
        deroulement: detail.deroulement,
        materiel: detail.materiel,
        resources: detail.resources,
        resourceIds: detail.resourceIds,
      };
    }),
  };
}

export function mapSeancePayloadToFormValues(payload: SeancePayload): SeancePreparationFormValues {
  const phasesSummary = payload.phases
    .filter((phase) => phase.summary.trim())
    .map((phase) => `${phase.title}: ${phase.summary.trim()}`);
  const deroulement = parseDeroulementSteps(payload.seance.metadata?.deroulement);
  if (deroulement.every((step) => !step.content.trim()) && phasesSummary.length > 0) {
    deroulement[0] = { ...deroulement[0]!, content: phasesSummary.join("\n\n") };
  }

  return {
    title: payload.seance.title,
    matiere: payload.seance.matiere,
    sousMatiere: payload.seance.sousMatiere,
    niveau: payload.seance.niveau,
    cycle: payload.seance.cycle,
    sessionDate: payload.seance.sessionDate ?? "",
    dureeMinutes: payload.seance.dureeMinutes,
    competences: Array.isArray(payload.seance.metadata?.competences)
      ? payload.seance.metadata!.competences.map(String).filter(Boolean)
      : payload.seance.competenceBo
        ? [payload.seance.competenceBo]
        : [],
    referentielIds: payload.seance.referentielIds,
    objectif: payload.seance.objectif,
    deroulement,
    materiel: [
      ...payload.seance.materiel.guides,
      ...payload.seance.materiel.albums,
      ...payload.seance.materiel.manipulation,
      ...payload.seance.materiel.autres,
    ],
    resources: payload.seance.resources,
    resourceIds: payload.seance.resourceIds,
  };
}

export function mapSeanceFormToUpdateInput(
  seanceId: string,
  values: SeancePreparationFormValues,
) {
  return {
    seanceId,
    ...mapSeanceFormToCreateInput(values),
  };
}

export function mapSequenceFormToUpdateInput(
  sequenceId: string,
  values: SequencePreparationFormValues,
) {
  return {
    sequenceId,
    ...mapSequenceFormToCreateInput(values),
  };
}
