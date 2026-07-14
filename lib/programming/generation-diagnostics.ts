import type { ProgrammingTable } from "./types";

export type ProgrammingGenerationStep =
  | "form-validation"
  | "payload-ready"
  | "context-built"
  | "ai-request-start"
  | "ai-response-received"
  | "ai-parse"
  | "validation"
  | "database-save-start"
  | "database-save-done"
  | "completed";

export function logProgrammingGeneration(
  step: ProgrammingGenerationStep,
  meta?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === "production" && step !== "completed") return;
  console.info(`[ProgrammingGeneration] step=${step}`, meta ?? {});
}

export function logProgrammingGenerationError(
  step: ProgrammingGenerationStep,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  console.error(`[ProgrammingGeneration] step=${step} failed`, {
    ...meta,
    message: error instanceof Error ? error.message : String(error),
  });
}

export function countFilledCells(tables: ProgrammingTable[]): number {
  let count = 0;
  for (const table of tables) {
    for (const period of table.periods) {
      const cell = period.cell;
      if (
        cell.content?.trim() ||
        cell.competences?.length ||
        cell.notions?.length ||
        cell.modules?.length
      ) {
        count += 1;
      }
    }
  }
  return count;
}

export function userMessageForGenerationError(error: unknown, step?: string): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("profil pédagogique") || message.includes("Profil")) {
    return "Certaines informations nécessaires à la génération sont manquantes. Complétez votre profil pédagogique.";
  }
  if (message.includes("GEMINI") || message.includes("Théa") || message.includes("API")) {
    return "La génération a échoué lors de l'analyse par l'IA. Vous pouvez réessayer sans perdre vos données.";
  }
  if (message.includes("référentiel") || message.includes("BO")) {
    return "Le document source ou le référentiel BO n'a pas pu être utilisé. Vérifiez la Bibliothèque documentaire.";
  }
  if (message.includes("enregistr") || message.includes("Supabase") || message.includes("insert")) {
    return "La programmation a été générée mais n'a pas pu être enregistrée.";
  }
  if (message.includes("aucune table") || message.includes("Aucune table")) {
    return "Aucune matière n'a pu être structurée pour cette programmation. Vérifiez la matière et le référentiel BO.";
  }
  if (message.includes("cellules vides") || message.includes("contenu généré")) {
    return "La génération a échoué avant l'enregistrement : le contenu produit est vide.";
  }
  if (step === "network") {
    return "Une erreur réseau est survenue. Vous pouvez réessayer sans perdre vos données.";
  }

  return message || "Impossible de générer la programmation.";
}
