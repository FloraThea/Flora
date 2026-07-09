import type {
  ExtractedEntityDraft,
  ExtractedRelationDraft,
  ParsedResource,
} from "../types";

/**
 * Prompt Théa spécialisé pour l'extraction pédagogique traçable.
 */
export function buildExtractKnowledgePrompt(
  text: string,
  parsedResource: ParsedResource,
): string {
  return `
Tu es Théa, l'assistante pédagogique de Flora.

Analyse ce document pédagogique et extrais uniquement les informations réellement présentes.

Type détecté : ${parsedResource.documentType}
Hiérarchie attendue : ${parsedResource.hierarchyTemplate.join(" > ")}

Réponds uniquement en JSON valide :

{
  "entities": [
    {
      "temp_id": "ent-1",
      "entity_type": "competence",
      "label": "",
      "content": "",
      "source_text": "",
      "confidence": 0.0,
      "chunk_index": 0
    }
  ],
  "relations": [
    {
      "source_temp_id": "ent-1",
      "target_temp_id": "ent-2",
      "relation_type": "utilise_dans",
      "confidence": 0.0
    }
  ],
  "tags": []
}

Types d'entités possibles :
competence, notion, objectif, materiel, methode, rituel, evaluation, projet, lexique, oeuvre, album, personnage, materiel_pedagogique, seance, module, activite, domaine, sous_domaine, attendu

Types de relations possibles :
utilise_dans, appartient_a, provient_de, travaille, associe_a, prepare, evalue

Règles strictes :
- Ne jamais inventer une compétence, notion ou objectif absent du texte.
- source_text doit être un extrait exact ou quasi exact du document.
- Si une information est absente, ne crée pas l'entité.
- confidence entre 0 et 1 selon la clarté de l'extrait.
- tags : mots-clés réellement pertinents (matière, niveau, thème, méthode, période...).

Document :
${text.slice(0, 12000)}
`;
}

export function parseKnowledgeExtraction(raw: string): {
  entities: ExtractedEntityDraft[];
  relations: ExtractedRelationDraft[];
  tags: string[];
} {
  try {
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as {
      entities?: Array<Record<string, unknown>>;
      relations?: Array<Record<string, unknown>>;
      tags?: string[];
    };

    const entities = (parsed.entities ?? [])
      .filter((item) => typeof item.label === "string" && item.label.trim())
      .map((item, index) => ({
        tempId: String(item.temp_id ?? `ent-${index + 1}`),
        entityType: String(item.entity_type ?? "notion"),
        label: String(item.label ?? "").trim(),
        content: String(item.content ?? item.label ?? "").trim(),
        sourceText: String(item.source_text ?? item.content ?? item.label ?? "").trim(),
        confidence: Number(item.confidence ?? 0.6),
        chunkIndex:
          typeof item.chunk_index === "number" ? item.chunk_index : undefined,
        metadata: {},
      }))
      .filter((item) => item.sourceText.length > 0);

    const entityIds = new Set(entities.map((entity) => entity.tempId));

    const relations = (parsed.relations ?? [])
      .filter(
        (item) =>
          entityIds.has(String(item.source_temp_id)) &&
          entityIds.has(String(item.target_temp_id)),
      )
      .map((item) => ({
        sourceTempId: String(item.source_temp_id),
        targetTempId: String(item.target_temp_id),
        relationType: String(item.relation_type ?? "associe_a"),
        confidence: Number(item.confidence ?? 0.6),
        metadata: {},
      }));

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string")
      : [];

    return { entities, relations, tags };
  } catch (error) {
    console.error("Erreur parsing extraction pédagogique :", error);
    return { entities: [], relations: [], tags: [] };
  }
}
