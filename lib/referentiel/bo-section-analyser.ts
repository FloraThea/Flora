import { buildBoSectionPrompt } from "@/lib/thea/prompts/analyseBoSection";
import { askThea } from "@/lib/thea/services/gemini";
import { extractJsonObject, toErrorMessage } from "@/lib/api/route-diagnostics";
import type { BoCompetenceDraft, BoCompetenceType, BoSectionChunk } from "./bo-types";
import { chunkSectionText } from "./bo-section-splitter";

function normalizeCompetenceType(value: string): BoCompetenceType {
  const normalized = value.toLowerCase().trim();
  if (normalized.includes("attendu")) return "attendu";
  if (normalized.includes("connaissance")) return "connaissance";
  if (normalized.includes("exemple") || normalized.includes("situation")) return "exemple";
  if (normalized.includes("progressiv")) return "progressivite";
  if (normalized.includes("competence")) return "competence";
  return "autre";
}

function parseSectionResponse(
  raw: string,
  section: BoSectionChunk,
  defaults: { cycle: string; matiere: string },
): BoCompetenceDraft[] {
  const safeJson =
    extractJsonObject(raw.replace(/```json/g, "").replace(/```/g, "").trim()) ??
    extractJsonObject(raw);

  if (!safeJson) {
    throw new Error(`Réponse Théa non JSON pour la section ${section.label}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(safeJson);
  } catch (error) {
    throw new Error(
      `JSON invalide pour ${section.label}: ${toErrorMessage(error)}`,
    );
  }

  const payload = parsed as { items?: unknown[] };
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error(`Réponse Théa invalide pour ${section.label}: items absent.`);
  }

  return payload.items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      cycle: String(item.cycle ?? defaults.cycle),
      niveau: String(item.niveau ?? ""),
      matiere: String(item.matiere ?? defaults.matiere),
      section: section.label,
      sectionId: section.id,
      domaine: String(item.domaine ?? section.label),
      sousDomaine: String(item.sousDomaine ?? item.sous_domaine ?? ""),
      competenceType: normalizeCompetenceType(String(item.competenceType ?? item.type ?? "competence")),
      competence: String(item.competence ?? item.label ?? "").trim(),
      sousCompetence: String(item.sousCompetence ?? item.sous_competence ?? "").trim(),
      sourceExcerpt: String(item.sourceExcerpt ?? item.source_excerpt ?? "").trim(),
      code: String(item.code ?? "").trim(),
    }))
    .filter((item) => item.competence.length > 0);
}

export async function analyseBoSection(
  section: BoSectionChunk,
  defaults: { cycle: string; matiere: string },
): Promise<BoCompetenceDraft[]> {
  const parts = chunkSectionText(section.text);
  const allItems: BoCompetenceDraft[] = [];

  for (const [index, part] of parts.entries()) {
    const prompt = buildBoSectionPrompt({
      sectionLabel: section.label,
      sectionPart: parts.length > 1 ? `${index + 1}/${parts.length}` : undefined,
      cycle: defaults.cycle,
      matiere: defaults.matiere,
      text: part,
    });

    const raw = await askThea(prompt);
    const items = parseSectionResponse(raw, section, defaults);

    for (const item of items) {
      if (!item.sourceExcerpt) {
        item.sourceExcerpt = part.slice(0, 240);
      }
      allItems.push(item);
    }
  }

  return allItems;
}

export async function analyseBoSections(
  sections: BoSectionChunk[],
  defaults: { cycle: string; matiere: string },
): Promise<BoCompetenceDraft[]> {
  const results: BoCompetenceDraft[] = [];

  for (const section of sections) {
    console.info("[bo-analyser] Analyse section", {
      section: section.label,
      textLength: section.text.length,
    });

    const items = await analyseBoSection(section, defaults);
    console.info("[bo-analyser] Section analysée", {
      section: section.label,
      items: items.length,
    });
    results.push(...items);
  }

  return dedupeCompetences(results);
}

function dedupeCompetences(items: BoCompetenceDraft[]): BoCompetenceDraft[] {
  const seen = new Set<string>();
  const output: BoCompetenceDraft[] = [];

  for (const item of items) {
    const key = [
      item.sectionId,
      item.niveau,
      item.competenceType,
      item.competence,
      item.sousCompetence,
    ]
      .join("|")
      .toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}
