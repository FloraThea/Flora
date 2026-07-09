import type { TheaResourceAnalysis } from "@/lib/thea/analyseResource";
import type {
  ExtractedEntityDraft,
  ParsedResource,
  PedagogicalExtractionResult,
} from "./types";

const BASE_TAGS = [
  "Français",
  "Mathématiques",
  "Lecture",
  "Compréhension",
  "Production d'écrit",
  "Orthographe",
  "Poésie",
  "Sciences",
  "Histoire",
  "Art",
  "Musique",
];

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ");
}

/**
 * Génère des tags automatiques traçables à partir du document et des entités.
 */
export class TagGenerator {
  generate(
    parsedResource: ParsedResource,
    extraction: PedagogicalExtractionResult,
    analysis?: TheaResourceAnalysis,
  ): string[] {
    const tags = new Set<string>();

    if (parsedResource.documentType) tags.add(parsedResource.documentType);
    if (analysis?.matiere) tags.add(analysis.matiere);
    if (analysis?.sous_matiere) tags.add(analysis.sous_matiere);
    if (analysis?.cycle) tags.add(analysis.cycle);
    if (analysis?.niveau) tags.add(analysis.niveau);
    if (analysis?.methode) tags.add(analysis.methode);

    extraction.tags.forEach((tag) => tags.add(normalizeTag(tag)));

    extraction.entities.forEach((entity) => {
      if (entity.entityType === "methode") tags.add(entity.label);
      if (entity.entityType === "projet") tags.add(entity.label);
      if (entity.entityType === "oeuvre") tags.add(entity.label);
      if (entity.entityType === "album") tags.add(entity.label);
    });

    for (const baseTag of BASE_TAGS) {
      const normalizedBase = baseTag.toLowerCase();
      const foundInEntities = extraction.entities.some((entity) =>
        `${entity.label} ${entity.content}`.toLowerCase().includes(normalizedBase),
      );
      if (foundInEntities) tags.add(baseTag);
    }

    if (/mhm/i.test(analysis?.methode ?? "")) tags.add("MHM");
    if (/narramus/i.test(analysis?.title ?? "")) tags.add("Narramus");

    return [...tags]
      .map(normalizeTag)
      .filter(Boolean)
      .filter((tag) => tag.length <= 60);
  }

  tagsFromEntities(entities: ExtractedEntityDraft[]): string[] {
    return entities
      .filter((entity) =>
        ["lexique", "notion", "methode", "projet", "oeuvre"].includes(
          String(entity.entityType),
        ),
      )
      .map((entity) => entity.label)
      .filter(Boolean);
  }
}

export const tagGenerator = new TagGenerator();
