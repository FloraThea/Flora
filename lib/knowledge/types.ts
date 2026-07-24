import type { TheaResourceAnalysis } from "@/lib/thea/analyseResource";
import type { TextChunkDraft } from "@/lib/documents/types";

export const ENTITY_TYPES = [
  "competence",
  "notion",
  "objectif",
  "materiel",
  "methode",
  "rituel",
  "evaluation",
  "projet",
  "lexique",
  "oeuvre",
  "album",
  "personnage",
  "materiel_pedagogique",
  "seance",
  "module",
  "activite",
  "domaine",
  "sous_domaine",
  "attendu",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const DOCUMENT_TYPE_CANDIDATES = [
  "BO",
  "guide du maître",
  "manuel",
  "album",
  "fichier d'exercices",
  "séquence",
  "cahier journal",
  "programmation",
  "progression",
  "ressource personnelle",
] as const;

export type DocumentTypeCandidate = (typeof DOCUMENT_TYPE_CANDIDATES)[number];

export type ParsedResource = {
  documentType: DocumentTypeCandidate | string;
  confidence: number;
  hierarchyTemplate: string[];
  signals: string[];
};

export type ExtractedEntityDraft = {
  tempId: string;
  entityType: EntityType | string;
  label: string;
  content: string;
  sourceText: string;
  confidence: number;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
};

export type ExtractedRelationDraft = {
  sourceTempId: string;
  targetTempId: string;
  relationType: string;
  confidence: number;
  metadata?: Record<string, unknown>;
};

export type PedagogicalExtractionResult = {
  entities: ExtractedEntityDraft[];
  relations: ExtractedRelationDraft[];
  tags: string[];
};

export type ReferentielRow = {
  id: string;
  competence: string;
  code: string | null;
  discipline: string | null;
  domaine: string | null;
  niveau: string | null;
  cycle: string | null;
};

export type BoMatchDraft = {
  entityTempId?: string;
  competenceLabel: string;
  referentielId: string | null;
  matchedLabel: string;
  confidence: number;
  matchMethod: "exact" | "fuzzy" | "none";
};

export type KnowledgeIndexDraft = {
  term: string;
  normalizedTerm: string;
  category: string;
  weight: number;
  entityTempId?: string;
  chunkIndex?: number;
  metadata?: Record<string, unknown>;
};

export type StoredPedagogicalEntity = {
  id: string;
  document_id: string;
  chunk_id: string | null;
  entity_type: string;
  label: string;
  content: string;
  source_text: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type StoredPedagogicalRelation = {
  id: string;
  document_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type StoredKnowledgeIndexEntry = {
  id: string;
  document_id: string;
  entity_id: string | null;
  chunk_id: string | null;
  term: string;
  normalized_term: string;
  category: string;
  weight: number;
  metadata: Record<string, unknown>;
};

export type StoredBoCompetenceLink = {
  id: string;
  document_id: string;
  entity_id: string | null;
  document_competence_id: string | null;
  referentiel_id: string | null;
  matched_label: string;
  confidence: number;
  match_method: string;
  metadata: Record<string, unknown>;
};

export type KnowledgePipelineInput = {
  documentId: string;
  text: string;
  filename: string;
  analysis?: TheaResourceAnalysis;
  existingMetadata?: Record<string, unknown>;
};

export type KnowledgePipelineResult = {
  parsedResource: ParsedResource;
  chunks: TextChunkDraft[];
  extraction: PedagogicalExtractionResult;
  tags: string[];
  boLinks: BoMatchDraft[];
  indexEntries: KnowledgeIndexDraft[];
  extractionMeta?: {
    method: "faithful" | "ai" | "chunks_only";
    moduleCount: number;
    seanceCount: number;
  };
};

export type ExplorerGraphNode = {
  id: string;
  label: string;
  type: string;
  group: "document" | "entity" | "tag" | "competence";
};

export type ExplorerGraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type ExplorerPayload = {
  document: Record<string, unknown>;
  sections: Array<Record<string, unknown>>;
  entities: StoredPedagogicalEntity[];
  tags: Array<Record<string, unknown>>;
  relations: StoredPedagogicalRelation[];
  boLinks: StoredBoCompetenceLink[];
  graph: {
    nodes: ExplorerGraphNode[];
    edges: ExplorerGraphEdge[];
  };
};

export type IntelligentSearchResult = {
  documentId: string;
  title: string;
  score: number;
  matchedTerms: string[];
  snippet: string;
};
