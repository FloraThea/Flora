import type { TeacherProfileBundle } from "@/lib/profile/types";
import { inferCycleFromLevels } from "@/lib/referentiel/bo-cycle-utils";
import { buildIndependentSequenceDraft } from "@/lib/sequences/independent-sequence-factory";
import type { SequenceDraft } from "@/lib/sequences/types";
import { buildIndependentSeanceDraft } from "@/lib/seances/independent-seance-factory";
import { parseSeanceEnrichment } from "@/lib/seances/prompts/generateSeance";
import type { SeanceDraft } from "@/lib/seances/types";
import type { TheaCreateDraftInput, TheaSeanceStructured, TheaSequenceStructured } from "./types";

function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse IA non structurée.");
    return JSON.parse(match[0]);
  }
}

function resolveNiveau(context: TheaCreateDraftInput, bundle: TeacherProfileBundle | null): string {
  return context.niveau?.trim() || bundle?.profile.levels[0]?.trim() || "";
}

function resolveCycle(niveau: string, bundle: TeacherProfileBundle | null): string {
  const levels = niveau ? [niveau] : bundle?.profile.levels ?? [];
  return levels.length > 0 ? inferCycleFromLevels(levels) : "";
}

function resolveMethode(bundle: TeacherProfileBundle | null): string {
  return bundle?.methods[0]?.methodName?.trim() ?? "";
}

export function parseTheaSeanceStructured(raw: string): TheaSeanceStructured {
  const parsed = extractJson(raw) as Partial<TheaSeanceStructured>;
  const title = parsed.title?.trim();
  const objectif = parsed.objectif?.trim();

  if (!title || !objectif) {
    throw new Error("La proposition de séance est incomplète (titre ou objectif manquant).");
  }

  return {
    title,
    competenceBo: parsed.competenceBo?.trim() ?? "",
    objectif,
    prerequis: parsed.prerequis ?? [],
    materiel: parsed.materiel ?? [],
    dureeMinutes: parsed.dureeMinutes ?? 45,
    methode: parsed.methode?.trim() ?? "",
    pedagogicalChoices: parsed.pedagogicalChoices ?? [],
    phases: parsed.phases ?? [],
    evaluation: parsed.evaluation ?? {},
    differentiation: parsed.differentiation ?? {},
    traceEcrite: parsed.traceEcrite ?? {},
  };
}

export function parseTheaSequenceStructured(raw: string): TheaSequenceStructured {
  const parsed = extractJson(raw) as Partial<TheaSequenceStructured>;
  const title = parsed.title?.trim();

  if (!title) {
    throw new Error("La proposition de séquence est incomplète (titre manquant).");
  }

  if (!parsed.sessions?.length) {
    throw new Error("La proposition de séquence doit contenir au moins une séance.");
  }

  return {
    title,
    competenceBo: parsed.competenceBo?.trim() ?? "",
    objectifs: parsed.objectifs ?? [],
    prerequis: parsed.prerequis ?? [],
    notions: parsed.notions ?? [],
    materiel: parsed.materiel ?? [],
    methode: parsed.methode?.trim() ?? "",
    sessions: parsed.sessions.map((session, index) => ({
      sessionNumber: session.sessionNumber ?? index + 1,
      title: session.title?.trim() || `Séance ${index + 1}`,
      objectif: session.objectif?.trim() ?? "",
      dureeMinutes: session.dureeMinutes ?? 45,
      placeProgression: session.placeProgression?.trim() ?? "",
    })),
    evaluationFinale: parsed.evaluationFinale ?? {},
    differentiation: parsed.differentiation ?? {},
  };
}

export function buildSeanceDraftFromTheaStructured(
  structured: TheaSeanceStructured,
  context: TheaCreateDraftInput,
  bundle: TeacherProfileBundle | null,
): SeanceDraft {
  const niveau = resolveNiveau(context, bundle);
  const base = buildIndependentSeanceDraft({
    title: structured.title,
    matiere: context.matiere,
    niveau,
    cycle: resolveCycle(niveau, bundle),
    dureeMinutes: structured.dureeMinutes ?? context.dureeMinutes ?? 45,
    competenceBo: structured.competenceBo,
    objectif: structured.objectif,
    prerequis: structured.prerequis,
    methode: structured.methode || resolveMethode(bundle),
    materiel: structured.materiel,
    evaluation: structured.evaluation?.formative,
  });

  const enriched = parseSeanceEnrichment(
    JSON.stringify({
      title: structured.title,
      objectif: structured.objectif,
      pedagogicalChoices: structured.pedagogicalChoices,
      traceEcrite: structured.traceEcrite,
      phases: structured.phases,
      evaluation: structured.evaluation,
      differentiation: structured.differentiation,
    }),
    base,
  );

  return {
    ...enriched,
    competenceBo: structured.competenceBo ?? enriched.competenceBo,
    materiel: {
      ...enriched.materiel,
      autres: structured.materiel?.length ? structured.materiel : enriched.materiel.autres,
    },
  };
}

export function buildSequenceDraftFromTheaStructured(
  structured: TheaSequenceStructured,
  context: TheaCreateDraftInput,
  bundle: TeacherProfileBundle | null,
): SequenceDraft {
  const niveau = resolveNiveau(context, bundle);
  const base = buildIndependentSequenceDraft({
    title: structured.title,
    matiere: context.matiere,
    niveau,
    cycle: resolveCycle(niveau, bundle),
    competenceBo: structured.competenceBo,
    objectifs: structured.objectifs,
    prerequis: structured.prerequis,
    notions: structured.notions,
    materiel: structured.materiel,
    methode: structured.methode || resolveMethode(bundle),
    sessionCount: structured.sessions?.length ?? context.sessionCount ?? 4,
    sessions: structured.sessions?.map((session) => ({
      title: session.title,
      objectif: session.objectif,
      dureeMinutes: session.dureeMinutes,
    })),
  });

  return {
    ...base,
    evaluationFinale: {
      label: structured.evaluationFinale?.label ?? "",
      criteres: structured.evaluationFinale?.criteres ?? [],
    },
    differentiation: {
      elevesEnDifficulte: structured.differentiation?.elevesEnDifficulte ?? [],
      elevesAvances: structured.differentiation?.elevesAvances ?? [],
      groupes: structured.differentiation?.groupes ?? [],
      adaptations: structured.differentiation?.adaptations ?? [],
    },
  };
}

export function formatSeancePreview(structured: TheaSeanceStructured): string {
  const lines = [
    structured.title,
    "",
    `Compétence : ${structured.competenceBo || "—"}`,
    `Objectif : ${structured.objectif}`,
  ];

  if (structured.materiel?.length) {
    lines.push("", "Matériel :", ...structured.materiel.map((item) => `• ${item}`));
  }

  if (structured.phases?.length) {
    lines.push("", "Déroulement :");
    for (const phase of structured.phases) {
      lines.push(
        `• ${phase.title || phase.phaseKey} (${phase.dureeMinutes ?? "?"} min) — ${phase.summary || ""}`.trim(),
      );
    }
  }

  if (structured.evaluation?.formative) {
    lines.push("", `Évaluation : ${structured.evaluation.formative}`);
  }

  return lines.join("\n").trim();
}

export function formatSequencePreview(structured: TheaSequenceStructured): string {
  const lines = [structured.title, ""];

  if (structured.objectifs?.length) {
    lines.push("Objectifs :", ...structured.objectifs.map((item) => `• ${item}`));
  }

  if (structured.prerequis?.length) {
    lines.push("", "Prérequis :", ...structured.prerequis.map((item) => `• ${item}`));
  }

  if (structured.sessions?.length) {
    lines.push("", "Plan des séances :");
    for (const session of structured.sessions) {
      lines.push(
        `${session.sessionNumber}. ${session.title} (${session.dureeMinutes ?? 45} min) — ${session.objectif || ""}`.trim(),
      );
    }
  }

  if (structured.evaluationFinale?.label) {
    lines.push("", `Évaluation finale : ${structured.evaluationFinale.label}`);
  }

  return lines.join("\n").trim();
}
