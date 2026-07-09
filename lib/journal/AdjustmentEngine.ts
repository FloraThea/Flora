import { askThea } from "@/lib/thea/services/gemini";
import { extractJsonObject } from "@/lib/api/route-diagnostics";
import type { JournalAdjustment, JournalEntry, StoredJournal } from "./types";

export class AdjustmentEngine {
  async proposeAdjustments(input: {
    journal: StoredJournal;
    entries: JournalEntry[];
  }): Promise<Omit<JournalAdjustment, "id" | "journalId">[]> {
    const incomplete = input.entries.filter(
      (entry) =>
        entry.observation?.status === "non_realisee" ||
        entry.observation?.status === "partielle",
    );

    if (incomplete.length === 0) {
      return [];
    }

    const prompt = `
Tu es Théa, l'assistante pédagogique de Flora.

Analyse cette journée de classe et propose des ajustements SANS les appliquer automatiquement.

Date : ${input.journal.journalDate}
Classe : ${input.journal.className}

Créneaux incomplets :
${JSON.stringify(
  incomplete.map((entry) => ({
    horaire: `${entry.startTime}-${entry.endTime}`,
    matiere: entry.matiere,
    objectif: entry.objectif,
    statut: entry.observation?.status,
    commentaires: entry.observation?.comments,
    difficultes: entry.observation?.difficulties,
  })),
  null,
  2,
)}

Réponds uniquement en JSON :
{
  "adjustments": [
    {
      "adjustmentType": "report|reorganisation|rebalance|adaptation",
      "title": "",
      "description": "",
      "payload": {}
    }
  ]
}
`;

    try {
      const raw = await askThea(prompt);
      const safeJson =
        extractJsonObject(raw.replace(/```json/g, "").replace(/```/g, "").trim()) ??
        extractJsonObject(raw);
      if (!safeJson) return this.fallbackProposals(incomplete);

      const parsed = JSON.parse(safeJson) as {
        adjustments?: Array<Record<string, unknown>>;
      };

      return (parsed.adjustments ?? []).map((item) => ({
        proposedBy: "thea",
        adjustmentType: String(item.adjustmentType ?? "adaptation"),
        title: String(item.title ?? "Ajustement proposé"),
        description: String(item.description ?? ""),
        payload: (item.payload as Record<string, unknown>) ?? {},
        status: "pending" as const,
      }));
    } catch {
      return this.fallbackProposals(incomplete);
    }
  }

  private fallbackProposals(
    entries: JournalEntry[],
  ): Omit<JournalAdjustment, "id" | "journalId">[] {
    return entries.slice(0, 3).map((entry) => ({
      proposedBy: "thea",
      adjustmentType: "report",
      title: `Reporter ${entry.matiere}`,
      description: `La séance « ${entry.objectif || entry.matiere} » n'a pas été menée à terme. Envisager un report au prochain créneau disponible.`,
      payload: {
        entryId: entry.id,
        seanceId: entry.seanceId,
        matiere: entry.matiere,
      },
      status: "pending" as const,
    }));
  }
}

export const adjustmentEngine = new AdjustmentEngine();
