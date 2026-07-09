import type { SeanceContext, SeanceDraft } from "../types";

export function buildSeancePrompt(context: SeanceContext, draft: SeanceDraft, profileInstructions = ""): string {
  return `
Tu es Théa, l'assistante pédagogique de Flora.

Enrichis cette séance pédagogique UNIQUEMENT à partir des données fournies.

${profileInstructions}

Règles strictes :
- Ne jamais inventer de compétence absente du BO ou de la séquence.
- Ne jamais modifier la méthode imposée : ${context.methode}.
- Conserver le nombre de phases et la durée totale (${draft.dureeMinutes} min).
- Toujours expliquer les choix pédagogiques dans pedagogicalChoices.
- Enrichir consignes, questions et trace écrite sans dupliquer les données sources.

Contexte séquence :
${JSON.stringify(
  {
    titre: context.sequencePayload.sequence.title,
    competenceBo: context.sequencePayload.sequence.competenceBo,
    objectifs: context.sequencePayload.sequence.objectifs,
    methode: context.methode,
    session: context.sequenceSession,
    progressionRow: {
      deroulement: context.progressionRow.deroulement,
      objectifs: context.progressionRow.objectifs,
      materiel: context.progressionRow.materiel,
    },
  },
  null,
  2,
)}

Brouillon de séance :
${JSON.stringify(draft, null, 2)}

Réponds uniquement en JSON valide :

{
  "title": "",
  "objectif": "",
  "pedagogicalChoices": ["explication du choix pédagogique"],
  "traceEcrite": {
    "enseignant": "",
    "eleve": "",
    "lecon": "",
    "aideMemoire": ""
  },
  "phases": [
    {
      "phaseKey": "accueil",
      "summary": "",
      "activities": [
        {
          "sortOrder": 1,
          "objectif": "",
          "consignesEnseignant": "",
          "consignesEleves": "",
          "organisation": "",
          "dureeMinutes": 5,
          "questions": [],
          "reponsesAttendues": [],
          "erreursFrequentes": [],
          "remediations": []
        }
      ]
    }
  ],
  "evaluation": {
    "formative": "",
    "criteresReussite": [],
    "observables": [],
    "remediations": []
  },
  "differentiation": {
    "elevesFragiles": [],
    "elevesAvances": [],
    "groupesBesoins": [],
    "adaptations": [],
    "variantes": []
  }
}
`.trim();
}

export function parseSeanceEnrichment(raw: string, draft: SeanceDraft): SeanceDraft {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return draft;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<SeanceDraft> & {
      traceEcrite?: SeanceDraft["traceEcrite"];
    };

    const enrichedPhases = draft.phases.map((phase) => {
      const incoming = parsed.phases?.find((item) => item.phaseKey === phase.phaseKey);
      if (!incoming) return phase;

      return {
        ...phase,
        summary: incoming.summary || phase.summary,
        activities: phase.activities.map((activity, index) => {
          const incomingActivity = incoming.activities?.[index];
          if (!incomingActivity) return activity;

          return {
            ...activity,
            objectif: incomingActivity.objectif || activity.objectif,
            consignesEnseignant:
              incomingActivity.consignesEnseignant || activity.consignesEnseignant,
            consignesEleves: incomingActivity.consignesEleves || activity.consignesEleves,
            organisation: incomingActivity.organisation || activity.organisation,
            questions: incomingActivity.questions?.length
              ? incomingActivity.questions
              : activity.questions,
            reponsesAttendues: incomingActivity.reponsesAttendues?.length
              ? incomingActivity.reponsesAttendues
              : activity.reponsesAttendues,
            erreursFrequentes: incomingActivity.erreursFrequentes?.length
              ? incomingActivity.erreursFrequentes
              : activity.erreursFrequentes,
            remediations: incomingActivity.remediations?.length
              ? incomingActivity.remediations
              : activity.remediations,
          };
        }),
      };
    });

    return {
      ...draft,
      title: parsed.title || draft.title,
      objectif: parsed.objectif || draft.objectif,
      pedagogicalChoices: parsed.pedagogicalChoices?.length
        ? parsed.pedagogicalChoices
        : draft.pedagogicalChoices,
      traceEcrite: parsed.traceEcrite
        ? {
            enseignant: parsed.traceEcrite.enseignant || draft.traceEcrite.enseignant,
            eleve: parsed.traceEcrite.eleve || draft.traceEcrite.eleve,
            lecon: parsed.traceEcrite.lecon || draft.traceEcrite.lecon,
            aideMemoire: parsed.traceEcrite.aideMemoire || draft.traceEcrite.aideMemoire,
          }
        : draft.traceEcrite,
      evaluation: parsed.evaluation
        ? {
            formative: parsed.evaluation.formative || draft.evaluation.formative,
            criteresReussite: parsed.evaluation.criteresReussite?.length
              ? parsed.evaluation.criteresReussite
              : draft.evaluation.criteresReussite,
            observables: parsed.evaluation.observables?.length
              ? parsed.evaluation.observables
              : draft.evaluation.observables,
            remediations: parsed.evaluation.remediations?.length
              ? parsed.evaluation.remediations
              : draft.evaluation.remediations,
          }
        : draft.evaluation,
      differentiation: parsed.differentiation
        ? {
            elevesFragiles: parsed.differentiation.elevesFragiles?.length
              ? parsed.differentiation.elevesFragiles
              : draft.differentiation.elevesFragiles,
            elevesAvances: parsed.differentiation.elevesAvances?.length
              ? parsed.differentiation.elevesAvances
              : draft.differentiation.elevesAvances,
            groupesBesoins: parsed.differentiation.groupesBesoins?.length
              ? parsed.differentiation.groupesBesoins
              : draft.differentiation.groupesBesoins,
            adaptations: parsed.differentiation.adaptations?.length
              ? parsed.differentiation.adaptations
              : draft.differentiation.adaptations,
            variantes: parsed.differentiation.variantes?.length
              ? parsed.differentiation.variantes
              : draft.differentiation.variantes,
          }
        : draft.differentiation,
      phases: enrichedPhases,
    };
  } catch {
    return draft;
  }
}
