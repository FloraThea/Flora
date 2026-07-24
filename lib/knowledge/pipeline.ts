import { floraDb } from "@/lib/supabase/get-db";
import type { TextChunkDraft } from "@/lib/documents/types";
import {
  extractFaithfulDocumentTree,
  hasFaithfulStructure,
} from "@/lib/pedagogical/document-tree";
import { buildFaithfulChunksFromTree } from "@/lib/pedagogical/document-tree/faithful-chunks";
import { chunkManager } from "./ChunkManager";
import { competenceMatcher } from "./CompetenceMatcher";
import { knowledgeIndexer } from "./KnowledgeIndexer";
import { pedagogicalExtractor } from "./PedagogicalExtractor";
import { relationBuilder } from "./RelationBuilder";
import { resourceParser } from "./ResourceParser";
import { searchEngine } from "./SearchEngine";
import { tagGenerator } from "./TagGenerator";
import type {
  ExplorerPayload,
  KnowledgePipelineInput,
  KnowledgePipelineResult,
  StoredPedagogicalEntity,
  ExplorerGraphNode,
  ExplorerGraphEdge,
} from "./types";

async function clearPreviousKnowledge(documentId: string) {
  await (await floraDb()).from("knowledge_index").delete().eq("document_id", documentId);
  await (await floraDb()).from("bo_competence_links").delete().eq("document_id", documentId);
  await (await floraDb()).from("pedagogical_relations").delete().eq("document_id", documentId);
  await (await floraDb()).from("pedagogical_entities").delete().eq("document_id", documentId);
}

/** Supprime toute l'analyse indexée pour un document (réutilisable avant purge). */
export async function clearDocumentKnowledge(documentId: string): Promise<void> {
  await clearPreviousKnowledge(documentId);
}

async function replaceSmartChunks(
  documentId: string,
  chunks: TextChunkDraft[],
): Promise<Array<{ id: string; chunk_index: number }>> {
  await (await floraDb()).from("document_chunks").delete().eq("document_id", documentId);

  if (chunks.length === 0) return [];

  const { data, error } = await (await floraDb())
    .from("document_chunks")
    .insert(
      chunks.map((chunk) => ({
        document_id: documentId,
        chunk_index: chunk.chunk_index,
        title: chunk.title,
        content: chunk.content,
        page_start: chunk.page_start,
        page_end: chunk.page_end,
        section_type: chunk.section_type,
        metadata: chunk.metadata,
      })),
    )
    .select("id, chunk_index");

  if (error) throw error;
  return data ?? [];
}

async function persistKnowledge(
  input: KnowledgePipelineInput,
  result: KnowledgePipelineResult,
  chunkRecords: Array<{ id: string; chunk_index: number }>,
) {
  const documentId = input.documentId;
  const chunkIdByIndex = new Map(
    chunkRecords.map((chunk) => [chunk.chunk_index, chunk.id]),
  );

  const entityRows = result.extraction.entities.map((entity) => ({
    document_id: documentId,
    chunk_id:
      entity.chunkIndex !== undefined
        ? chunkIdByIndex.get(entity.chunkIndex) ?? null
        : null,
    entity_type: entity.entityType,
    label: entity.label,
    content: entity.content,
    source_text: entity.sourceText,
    confidence: entity.confidence,
    metadata: {
      ...(entity.metadata ?? {}),
      temp_id: entity.tempId,
    },
  }));

  const { data: insertedEntities, error: entityError } = await (await floraDb())
    .from("pedagogical_entities")
    .insert(entityRows)
    .select("*");

  if (entityError) throw entityError;

  const entityMap = new Map<string, StoredPedagogicalEntity>();
  (insertedEntities ?? []).forEach((entity) => {
    const tempId = String(
      (entity.metadata as Record<string, unknown> | null)?.temp_id ?? "",
    );
    if (tempId) entityMap.set(tempId, entity as StoredPedagogicalEntity);
  });

  const mappedRelations = relationBuilder.mapRelations(
    result.extraction.relations,
    entityMap,
    documentId,
  );

  const inferredRelations = relationBuilder.inferHierarchyRelations(
    [...entityMap.values()],
    documentId,
  );

  if (mappedRelations.length + inferredRelations.length > 0) {
    await (await floraDb())
      .from("pedagogical_relations")
      .insert([...mappedRelations, ...inferredRelations]);
  }

  const tagRows = [...new Set(result.tags)].map((tag) => ({
    document_id: documentId,
    tag,
  }));

  if (tagRows.length > 0) {
    await (await floraDb()).from("document_tags").delete().eq("document_id", documentId);
    await (await floraDb()).from("document_tags").insert(tagRows);
  }

  const boRows = result.boLinks
    .filter((link) => link.referentielId && link.confidence >= 0.45)
    .map((link) => ({
      document_id: documentId,
      entity_id: link.entityTempId
        ? entityMap.get(link.entityTempId)?.id ?? null
        : null,
      referentiel_id: link.referentielId,
      matched_label: link.matchedLabel,
      confidence: link.confidence,
      match_method: link.matchMethod,
      metadata: { competence_label: link.competenceLabel },
    }));

  if (boRows.length > 0) {
    await (await floraDb()).from("bo_competence_links").insert(boRows);
  }

  const indexRows = result.indexEntries.map((entry) => ({
    document_id: documentId,
    entity_id: entry.entityTempId
      ? entityMap.get(entry.entityTempId)?.id ?? null
      : null,
    chunk_id:
      entry.chunkIndex !== undefined
        ? chunkIdByIndex.get(entry.chunkIndex) ?? null
        : null,
    term: entry.term,
    normalized_term: entry.normalizedTerm,
    category: entry.category,
    weight: entry.weight,
    metadata: entry.metadata ?? {},
  }));

  if (indexRows.length > 0) {
    await (await floraDb()).from("knowledge_index").insert(indexRows);
  }

  await (await floraDb())
    .from("documents")
    .update({
      document_type: result.parsedResource.documentType,
      metadata: {
        ...(input.existingMetadata ?? {}),
        knowledge_processed_at: new Date().toISOString(),
        type_confidence: result.parsedResource.confidence,
        hierarchy_template: result.parsedResource.hierarchyTemplate,
        parser_signals: result.parsedResource.signals,
        entities_count: insertedEntities?.length ?? 0,
        tags_count: tagRows.length,
        index_count: indexRows.length,
        bo_links_count: boRows.length,
        faithful_module_count: result.extractionMeta?.moduleCount ?? 0,
        faithful_seance_count: result.extractionMeta?.seanceCount ?? 0,
        extraction_method: result.extractionMeta?.method ?? "ai",
      },
    })
    .eq("id", documentId);
}

/**
 * Pipeline complet du moteur de connaissances pédagogiques.
 */
export async function runKnowledgePipeline(
  input: KnowledgePipelineInput & { skipAiExtraction?: boolean },
): Promise<KnowledgePipelineResult> {
  const parsedResource = resourceParser.parse(
    input.text,
    input.filename,
    input.analysis?.document_type ?? "",
  );

  const faithful = extractFaithfulDocumentTree({
    text: input.text,
    filename: input.filename,
    documentType: parsedResource.documentType,
    documentId: input.documentId,
    documentTitle: input.filename,
  });

  const useFaithfulStructure = hasFaithfulStructure(faithful);
  const chunks = chunkManager.buildSmartChunks(input.text, parsedResource);

  let chunksToPersist = chunks;
  if (useFaithfulStructure && faithful.tree.root.children.length > 0) {
    const faithfulChunks = buildFaithfulChunksFromTree(faithful.tree.root);
    if (faithfulChunks.length > 0) {
      chunksToPersist = faithfulChunks;
    }
  }

  let extraction = {
    entities: [] as KnowledgePipelineResult["extraction"]["entities"],
    relations: [] as KnowledgePipelineResult["extraction"]["relations"],
    tags: [] as string[],
  };

  if (useFaithfulStructure) {
    extraction = {
      entities: faithful.entities.map((entity) => ({
        tempId: entity.tempId,
        entityType: entity.entityType,
        label: entity.label,
        content: entity.content,
        sourceText: entity.sourceText,
        confidence: entity.confidence,
        metadata: {
          ...(entity.metadata ?? {}),
          parentTempId: entity.parentTempId,
          extractionMethod: "faithful",
        },
      })),
      relations: faithful.relations.map((relation) => ({
        sourceTempId: relation.sourceTempId,
        targetTempId: relation.targetTempId,
        relationType: relation.relationType,
        confidence: relation.confidence,
      })),
      tags: [],
    };
  } else if (!input.skipAiExtraction) {
    try {
      extraction = await pedagogicalExtractor.extract(input.text, parsedResource);
    } catch (error) {
      console.error("Extraction pédagogique Théa :", error);
    }
  }

  const tags = tagGenerator.generate(parsedResource, extraction, input.analysis);
  const boLinks = await competenceMatcher.matchEntities(extraction.entities);
  const indexEntries = knowledgeIndexer.buildIndex({
    chunks: chunksToPersist,
    extraction,
    tags,
    analysis: input.analysis,
  });

  const result: KnowledgePipelineResult = {
    parsedResource,
    chunks: chunksToPersist,
    extraction,
    tags,
    boLinks,
    indexEntries,
    extractionMeta: {
      method: useFaithfulStructure ? "faithful" : input.skipAiExtraction ? "chunks_only" : "ai",
      moduleCount: faithful.tree.moduleCount,
      seanceCount: faithful.tree.seanceCount,
    },
  };

  await clearPreviousKnowledge(input.documentId);
  const chunkRecords = await replaceSmartChunks(input.documentId, chunksToPersist);
  await persistKnowledge(input, result, chunkRecords);

  return result;
}

export async function getExplorerPayload(
  documentId: string,
): Promise<ExplorerPayload | null> {
  const { data: document, error } = await (await floraDb())
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error || !document) return null;

  const [
    { data: sections },
    { data: entities },
    { data: tags },
    { data: relations },
    { data: boLinks },
  ] = await Promise.all([
    (await floraDb())
      .from("document_chunks")
      .select("*")
      .eq("document_id", documentId)
      .order("chunk_index"),
    (await floraDb()).from("pedagogical_entities").select("*").eq("document_id", documentId),
    (await floraDb()).from("document_tags").select("*").eq("document_id", documentId),
    (await floraDb()).from("pedagogical_relations").select("*").eq("document_id", documentId),
    (await floraDb()).from("bo_competence_links").select("*").eq("document_id", documentId),
  ]);

  const entityList = (entities ?? []) as StoredPedagogicalEntity[];

  const nodes: ExplorerGraphNode[] = [
    {
      id: documentId,
      label: document.title || document.original_filename,
      type: "document",
      group: "document" as const,
    },
    ...entityList.map((entity) => ({
      id: entity.id,
      label: entity.label,
      type: entity.entity_type,
      group: "entity" as const,
    })),
    ...(tags ?? []).map((tag) => ({
      id: `tag-${tag.id}`,
      label: tag.tag,
      type: "tag",
      group: "tag" as const,
    })),
  ];

  const edges: ExplorerGraphEdge[] = (relations ?? []).map((relation) => ({
    id: relation.id,
    source: relation.source_entity_id,
    target: relation.target_entity_id,
    label: relation.relation_type,
  }));

  (boLinks ?? []).forEach((link) => {
    if (link.entity_id && link.referentiel_id) {
      edges.push({
        id: `bo-${link.id}`,
        source: link.entity_id,
        target: `bo-${link.referentiel_id}`,
        label: "relie_au_BO",
      });
      nodes.push({
        id: `bo-${link.referentiel_id}`,
        label: link.matched_label,
        type: "competence",
        group: "competence",
      });
    }
  });

  return {
    document,
    sections: sections ?? [],
    entities: entityList,
    tags: tags ?? [],
    relations: relations ?? [],
    boLinks: boLinks ?? [],
    graph: { nodes, edges },
  };
}

export { searchEngine };
