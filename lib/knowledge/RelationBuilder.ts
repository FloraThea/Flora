import type {
  ExtractedRelationDraft,
  StoredPedagogicalEntity,
  StoredPedagogicalRelation,
} from "./types";

/**
 * Construit et persiste les relations entre entités pédagogiques.
 */
export class RelationBuilder {
  mapRelations(
    drafts: ExtractedRelationDraft[],
    entityMap: Map<string, StoredPedagogicalEntity>,
    documentId: string,
  ): Array<Omit<StoredPedagogicalRelation, "id" | "created_at">> {
    return drafts
      .map((draft) => {
        const source = entityMap.get(draft.sourceTempId);
        const target = entityMap.get(draft.targetTempId);
        if (!source || !target) return null;

        return {
          document_id: documentId,
          source_entity_id: source.id,
          target_entity_id: target.id,
          relation_type: draft.relationType,
          confidence: draft.confidence,
          metadata: draft.metadata ?? {},
        };
      })
      .filter((item): item is Omit<StoredPedagogicalRelation, "id" | "created_at"> => item !== null);
  }

  inferHierarchyRelations(
    entities: StoredPedagogicalEntity[],
    documentId: string,
  ): Array<Omit<StoredPedagogicalRelation, "id" | "created_at">> {
    const relations: Array<Omit<StoredPedagogicalRelation, "id" | "created_at">> =
      [];

    const sorted = [...entities].sort((a, b) => {
      const levelA = Number(a.metadata?.level ?? 0);
      const levelB = Number(b.metadata?.level ?? 0);
      return levelA - levelB;
    });

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];

      relations.push({
        document_id: documentId,
        source_entity_id: current.id,
        target_entity_id: previous.id,
        relation_type: "appartient_a",
        confidence: 0.55,
        metadata: { inferred: true },
      });
    }

    return relations;
  }
}

export const relationBuilder = new RelationBuilder();
