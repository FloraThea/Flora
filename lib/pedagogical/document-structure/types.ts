/**
 * Structure organisationnelle détectée d'un document pédagogique importé.
 * Utilisée par programmation, progression, séquences et séances.
 */
export type DocumentStructureKind =
  | "modules"
  | "sequences"
  | "periodes"
  | "unites"
  | "projets"
  | "libre";

/** Niveau de regroupement pour une séquence Flora. */
export type SequenceGroupingLevel =
  | "module"
  | "sequence"
  | "periode"
  | "unite"
  | "projet"
  | "row";

export type DocumentStructure = {
  /** Valeur principale stockée dans metadata.structure_document */
  kind: DocumentStructureKind;
  /** Comment regrouper les lignes de progression en séquences */
  sequenceGrouping: SequenceGroupingLevel;
  /** Niveaux hiérarchiques détectés (ordre du document) */
  levels: string[];
  /** Libellés affichés par niveau */
  labels: Partial<Record<SequenceGroupingLevel, string>>;
  /** Signaux ayant conduit à la détection */
  signals: string[];
  /** Origine de la structure */
  source: "detected" | "method" | "manual";
};

export const MHM_MATH_STRUCTURE: DocumentStructure = {
  kind: "modules",
  sequenceGrouping: "module",
  levels: ["partie", "module", "seance"],
  labels: { module: "Module", sequence: "Séquence", periode: "Période" },
  signals: ["mhm-math-method"],
  source: "method",
};

export const LIBRE_STRUCTURE: DocumentStructure = {
  kind: "libre",
  sequenceGrouping: "row",
  levels: ["seance"],
  labels: {},
  signals: ["default-libre"],
  source: "detected",
};
