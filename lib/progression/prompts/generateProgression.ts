import type { ProgrammingTable } from "@/lib/programming/types";
import type { ProgressionContext, ProgressionRowDraft } from "../types";

export function buildProgressionPrompt(
  context: ProgressionContext,
  table: ProgrammingTable,
  rows: ProgressionRowDraft[],
  profileInstructions = "",
): string {
  return `
Tu es Théa, l'assistante pédagogique de Flora.

Enrichis cette progression à partir UNIQUEMENT de la programmation validée et des ressources fournies.

${profileInstructions}

Méthode imposée : ${context.methode}
Matière / sous-matière : ${table.subjectLabel} / ${table.subSubjectLabel || table.subjectLabel}

Règles strictes :
- Ne jamais inventer de compétence absente de la programmation ou du BO.
- Ne jamais modifier l'ordre imposé par la méthode.
- Respecter les semaines et périodes calculées.
- Objectifs et déroulements concis, exploitables en classe.

Programmation source :
${JSON.stringify(table.periods, null, 2)}

Lignes de progression à enrichir :
${JSON.stringify(rows.slice(0, 40), null, 2)}

Réponds uniquement en JSON valide :

{
  "rows": [
    {
      "index": 0,
      "objectifs": [],
      "deroulement": "",
      "materiel": [],
      "resources": [],
      "remarques": ""
    }
  ]
}
`;
}

export function parseProgressionEnrichment(
  raw: string,
  rows: ProgressionRowDraft[],
): ProgressionRowDraft[] {
  try {
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      rows?: Array<{
        index?: number;
        objectifs?: string[];
        deroulement?: string;
        materiel?: string[];
        resources?: string[];
        remarques?: string;
      }>;
    };

    return rows.map((row, index) => {
      const enriched = parsed.rows?.find((item) => item.index === index);
      if (!enriched) return row;

      return {
        ...row,
        objectifs: enriched.objectifs?.length ? enriched.objectifs : row.objectifs,
        deroulement: enriched.deroulement || row.deroulement,
        materiel: enriched.materiel?.length ? enriched.materiel : row.materiel,
        resources: enriched.resources?.length ? enriched.resources : row.resources,
        remarques: enriched.remarques || row.remarques,
      };
    });
  } catch (error) {
    console.error("Erreur parsing enrichissement progression :", error);
    return rows;
  }
}
