/**
 * Modèle hiérarchique normalisé pour tous les documents importés.
 * Le document source est la vérité — cette structure ne réorganise pas le contenu.
 */
export type DocumentTreeNodeType =
  | "document"
  | "partie"
  | "chapitre"
  | "module"
  | "sequence"
  | "unite"
  | "seance"
  | "activite"
  | "objectif"
  | "competence"
  | "materiel"
  | "ressource";

export type DocumentTreeProvenance = {
  documentId?: string;
  documentTitle?: string;
  pageStart?: number;
  pageEnd?: number;
  sourceText?: string;
  sourcePath?: string;
};

export type DocumentTreeNode = {
  id: string;
  type: DocumentTreeNodeType;
  label: string;
  content: string;
  order: number;
  children: DocumentTreeNode[];
  provenance: DocumentTreeProvenance;
  metadata?: Record<string, unknown>;
};

export type DocumentTree = {
  root: DocumentTreeNode;
  documentType: string;
  hierarchyTemplate: string[];
  signals: string[];
  moduleCount: number;
  seanceCount: number;
};

export type FaithfulExtractionResult = {
  tree: DocumentTree;
  entities: Array<{
    tempId: string;
    entityType: string;
    label: string;
    content: string;
    sourceText: string;
    confidence: number;
    parentTempId?: string;
    metadata?: Record<string, unknown>;
  }>;
  relations: Array<{
    sourceTempId: string;
    targetTempId: string;
    relationType: string;
    confidence: number;
  }>;
};
