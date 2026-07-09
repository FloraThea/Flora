import { askThea } from "@/lib/thea/services/gemini";
import { buildAnalyseDocumentPrompt } from "@/lib/thea/prompts/analyseDocument";
import { extractJsonObject, toErrorMessage } from "@/lib/api/route-diagnostics";

export type BoReferenceDraft = {
  cycle: string;
  niveau: string;
  matiere: string;
  sousMatiere: string;
  sousSousMatiere: string;
  competence: string;
  sousCompetence: string;
  code: string;
  source: string;
};

export type AnalyseBoDocumentResult = {
  references: BoReferenceDraft[];
  modelResponse: string;
};

function normalizeReference(row: Partial<BoReferenceDraft>): BoReferenceDraft {
  return {
    cycle: row.cycle ?? "",
    niveau: row.niveau ?? "",
    matiere: row.matiere ?? "",
    sousMatiere: row.sousMatiere ?? "",
    sousSousMatiere: row.sousSousMatiere ?? "",
    competence: row.competence ?? "",
    sousCompetence: row.sousCompetence ?? "",
    code: row.code ?? "",
    source: row.source ?? "",
  };
}

export async function analyseBoDocumentText(
  text: string,
  options?: { maxChars?: number },
): Promise<AnalyseBoDocumentResult> {
  const maxChars = options?.maxChars ?? 12000;
  const excerpt = text.slice(0, maxChars);

  if (!excerpt.trim()) {
    throw new Error("Le texte extrait du document est vide.");
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("La variable d'environnement GEMINI_API_KEY est absente.");
  }

  const rawText = (
    await askThea(buildAnalyseDocumentPrompt(excerpt))
  ).trim();

  const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
  const safeJson = extractJsonObject(cleaned) ?? extractJsonObject(rawText);

  if (!safeJson) {
    throw new Error("Théa a répondu dans un format non JSON.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(safeJson);
  } catch (error) {
    throw new Error(`Impossible d'interpréter la réponse JSON de Théa : ${toErrorMessage(error)}`);
  }

  const payload = parsed as { references?: unknown };
  if (!payload || !Array.isArray(payload.references)) {
    throw new Error("La réponse Théa ne contient pas `references` sous forme de tableau.");
  }

  const references = payload.references
    .filter((row): row is Partial<BoReferenceDraft> => Boolean(row) && typeof row === "object")
    .map(normalizeReference);

  return { references, modelResponse: rawText };
}
