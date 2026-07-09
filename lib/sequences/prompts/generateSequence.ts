import type { SequenceContext, SequenceDraft } from "../types";

export function buildSequencePrompt(
  context: SequenceContext,
  draft: SequenceDraft,
  profileInstructions = "",
): string {
  return `
Tu es Théa, l'assistante pédagogique de Flora.

Enrichis cette séquence pédagogique UNIQUEMENT à partir des données fournies.

${profileInstructions}

Méthode imposée : ${context.methode}
Ligne de progression source :
${JSON.stringify(context.row, null, 2)}

Brouillon de séquence :
${JSON.stringify(draft, null, 2)}

Règles strictes :
- Ne jamais inventer de compétence absente du BO ou de la progression.
- Ne jamais modifier la méthode imposée.
- Conserver le nombre de séances calculé.
- Proposer des objectifs, déroulements et évaluations concis et exploitables.

Réponds uniquement en JSON valide :

{
  "title": "",
  "objectifs": [],
  "notions": [],
  "vocabulaire": [],
  "prolongements": [],
  "sessions": [
    {
      "sessionNumber": 1,
      "title": "",
      "objectif": "",
      "placeProgression": ""
    }
  ],
  "evaluations": [
    {
      "evaluationType": "formative",
      "label": "",
      "criteres": []
    }
  ],
  "differentiation": {
    "elevesEnDifficulte": [],
    "elevesAvances": [],
    "groupes": [],
    "adaptations": []
  }
}
`;
}

export function parseSequenceEnrichment(raw: string, draft: SequenceDraft): SequenceDraft {
  try {
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as Partial<SequenceDraft> & {
      sessions?: Array<Record<string, unknown>>;
      evaluations?: Array<Record<string, unknown>>;
    };

    return {
      ...draft,
      title: parsed.title || draft.title,
      objectifs: parsed.objectifs?.length ? parsed.objectifs : draft.objectifs,
      notions: parsed.notions?.length ? parsed.notions : draft.notions,
      vocabulaire: parsed.vocabulaire?.length ? parsed.vocabulaire : draft.vocabulaire,
      prolongements: parsed.prolongements?.length ? parsed.prolongements : draft.prolongements,
      differentiation: parsed.differentiation ?? draft.differentiation,
      sessions: (parsed.sessions ?? draft.sessions).map((session, index) => ({
        sessionNumber: Number(session.sessionNumber ?? index + 1),
        title: String(session.title ?? draft.sessions[index]?.title ?? `Séance ${index + 1}`),
        objectif: String(session.objectif ?? draft.sessions[index]?.objectif ?? ""),
        dureeMinutes: Number(session.dureeMinutes ?? draft.sessions[index]?.dureeMinutes ?? 45),
        ordrePedagogique: Number(session.ordrePedagogique ?? index + 1),
        placeProgression: String(
          session.placeProgression ?? draft.sessions[index]?.placeProgression ?? "",
        ),
      })),
      evaluations: (parsed.evaluations ?? draft.evaluations).map((evaluation, index) => ({
        evaluationType: (evaluation.evaluationType ??
          draft.evaluations[index]?.evaluationType ??
          "formative") as "diagnostic" | "formative" | "summative",
        label: String(evaluation.label ?? draft.evaluations[index]?.label ?? ""),
        criteres: Array.isArray(evaluation.criteres)
          ? evaluation.criteres.filter((item): item is string => typeof item === "string")
          : draft.evaluations[index]?.criteres ?? [],
      })),
    };
  } catch (error) {
    console.error("Erreur parsing enrichissement séquence :", error);
    return draft;
  }
}
