import type { ParsedProgrammationImport } from "./types";

export function validateProgrammingAnalysisResponse(
  response: ParsedProgrammationImport,
): { ok: true } | { ok: false; error: string } {
  if (!response || typeof response !== "object") {
    return { ok: false, error: "Le service d'analyse n'a renvoyé aucune donnée." };
  }

  if (!Array.isArray(response.rows)) {
    return {
      ok: false,
      error: "La réponse reçue ne correspond pas au schéma attendu pour une programmation.",
    };
  }

  if (response.rowCount === 0 && !response.extractedTextPreview?.trim()) {
    return {
      ok: false,
      error: "Le service d'analyse n'a renvoyé aucune donnée exploitable.",
    };
  }

  return { ok: true };
}
