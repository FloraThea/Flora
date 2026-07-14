import "server-only";

import { askThea } from "@/lib/thea/services/gemini";
import { extractJsonObject } from "@/lib/api/route-diagnostics";
import { buildTheaInstructionBlock, loadTeacherProfileForGeneration } from "@/lib/profile";
import type { JournalEntry } from "./types";

export type GeneratedJournalEntryContent = {
  competence: string;
  objectif: string;
  organisation: string;
  materiel: string[];
  resources: string[];
  observations: string;
};

export class JournalEntryGenerator {
  async generateForSlot(input: {
    date: string;
    entry: Pick<
      JournalEntry,
      "matiere" | "startTime" | "endTime" | "dureeMinutes" | "slotData" | "objectif"
    >;
    hints?: {
      niveau?: string;
      theme?: string;
      objectifSouhaite?: string;
    };
  }): Promise<GeneratedJournalEntryContent> {
    const teacherProfile = await loadTeacherProfileForGeneration();
    const subSubject = String(input.entry.slotData.subSubject ?? "");
    const instructionBlock = buildTheaInstructionBlock(teacherProfile);

    const prompt = `
Tu es Théa, l'assistante pédagogique de Flora.
${instructionBlock}

Génère le contenu pédagogique d'UN créneau de cahier journal.

Date : ${input.date}
Matière : ${input.entry.matiere}
Sous-matière : ${subSubject || "non précisée"}
Horaires : ${input.entry.startTime} – ${input.entry.endTime}
Durée : ${input.entry.dureeMinutes} minutes
Niveau : ${input.hints?.niveau ?? (teacherProfile.profile.levels.join(", ") || "non précisé")}
Thème souhaité : ${input.hints?.theme ?? "libre"}
Objectif souhaité : ${input.hints?.objectifSouhaite ?? (input.entry.objectif || "à définir")}

Réponds UNIQUEMENT en JSON :
{
  "competence": "",
  "objectif": "",
  "organisation": "",
  "materiel": [],
  "resources": [],
  "observations": ""
}
`;

    try {
      const raw = await askThea(prompt);
      const safeJson =
        extractJsonObject(raw.replace(/```json/g, "").replace(/```/g, "").trim()) ??
        extractJsonObject(raw);
      if (!safeJson) throw new Error("Réponse Théa invalide.");

      const parsed = JSON.parse(safeJson) as Partial<GeneratedJournalEntryContent>;
      return {
        competence: String(parsed.competence ?? "").trim(),
        objectif: String(parsed.objectif ?? "").trim(),
        organisation: String(parsed.organisation ?? "").trim(),
        materiel: Array.isArray(parsed.materiel)
          ? parsed.materiel.map((item) => String(item)).filter(Boolean)
          : [],
        resources: Array.isArray(parsed.resources)
          ? parsed.resources.map((item) => String(item)).filter(Boolean)
          : [],
        observations: String(parsed.observations ?? "").trim(),
      };
    } catch (error) {
      console.error("[journal-entry-generator]", error);
      throw new Error("Théa n'a pas pu générer le contenu de ce créneau.");
    }
  }
}

export const journalEntryGenerator = new JournalEntryGenerator();
