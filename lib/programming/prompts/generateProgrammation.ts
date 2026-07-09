import type {
  PlannerContext,
  ProgrammingGenerationInput,
  ProgrammingTable,
} from "../types";

export function buildProgrammationPrompt(
  input: ProgrammingGenerationInput,
  context: PlannerContext,
  skeletons: ProgrammingTable[],
  profileInstructions = "",
): string {
  return `
Tu es Théa, l'assistante pédagogique de Flora.

Génère une programmation annuelle professionnelle UNIQUEMENT à partir des données fournies.

${profileInstructions}

Règles strictes :
- Ne jamais inventer de compétence absente du référentiel BO fourni.
- Ne jamais modifier l'ordre imposé par la méthode (${input.methode || "non précisée"}).
- Respecter le nombre réel de semaines de chaque période (calculé automatiquement).
- Une matière / sous-matière = un tableau indépendant.
- Ne jamais mélanger plusieurs matières dans un même tableau.
- Utiliser les ressources importées quand elles sont pertinentes.
- Thèmes concis, pas de séances détaillées.

Entrées enseignant :
${JSON.stringify(input, null, 2)}

Calendrier calculé (semaines réelles par période) :
${JSON.stringify(context.calendar.periods, null, 2)}

Référentiel BO disponible :
${JSON.stringify(context.referentiel.slice(0, 120), null, 2)}

Ressources importées :
${JSON.stringify(context.resources.slice(0, 40), null, 2)}

Emploi du temps :
${JSON.stringify(context.timetable, null, 2)}

Tableaux attendus (subjectKey) :
${JSON.stringify(
  skeletons.map((table) => ({
    subjectKey: table.subjectKey,
    subjectLabel: table.subjectLabel,
    subSubjectLabel: table.subSubjectLabel,
    periods: table.periods.map((period) => ({
      periodNumber: period.periodNumber,
      weekCount: period.weekCount,
    })),
  })),
  null,
  2,
)}

Réponds uniquement en JSON valide :

{
  "title": "",
  "tables": [
    {
      "subjectKey": "",
      "periods": [
        {
          "periodNumber": 1,
          "competences": [],
          "notions": [],
          "resources": [],
          "guides": [],
          "modules": [],
          "content": ""
        }
      ]
    }
  ]
}
`;
}

export type GeneratedTablePayload = {
  subjectKey: string;
  periods: Array<{
    periodNumber: number;
    competences?: string[];
    notions?: string[];
    resources?: string[];
    guides?: string[];
    modules?: string[];
    content?: string;
  }>;
};

export function parseProgrammationResponse(
  raw: string,
  skeletons: ProgrammingTable[],
): { title: string; tables: GeneratedTablePayload[] } {
  try {
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      title?: string;
      tables?: Array<{
        subjectKey?: string;
        periods?: Array<Record<string, unknown>>;
      }>;
    };

    return {
      title: parsed.title || "Programmation annuelle",
      tables: (parsed.tables ?? []).map((table) => ({
        subjectKey: String(table.subjectKey ?? ""),
        periods: (table.periods ?? []).map((period) => ({
          periodNumber: Number(period.periodNumber ?? 0),
          competences: Array.isArray(period.competences)
            ? period.competences.filter((item): item is string => typeof item === "string")
            : [],
          notions: Array.isArray(period.notions)
            ? period.notions.filter((item): item is string => typeof item === "string")
            : [],
          resources: Array.isArray(period.resources)
            ? period.resources.filter((item): item is string => typeof item === "string")
            : [],
          guides: Array.isArray(period.guides)
            ? period.guides.filter((item): item is string => typeof item === "string")
            : [],
          modules: Array.isArray(period.modules)
            ? period.modules.filter((item): item is string => typeof item === "string")
            : [],
          content: String(period.content ?? ""),
        })),
      })),
    };
  } catch (error) {
    console.error("Erreur parsing programmation :", error);
    return {
      title: "Programmation annuelle",
      tables: skeletons.map((table) => ({
        subjectKey: table.subjectKey,
        periods: table.periods.map((period) => ({
          periodNumber: period.periodNumber,
          competences: [],
          notions: [],
          resources: [],
          guides: [],
          modules: [],
          content: "",
        })),
      })),
    };
  }
}
