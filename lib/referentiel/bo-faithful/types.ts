export type BoTableFormat =
  | "objectifs_exemples"
  | "frequency_matrix"
  | "connaissances_associees"
  | "unknown";

export type BoFaithfulHierarchy = {
  cycle: string;
  niveau: string;
  matiere: string;
  sousMatiere: string;
  sousSousMatiere: string;
};

export type BoFaithfulCompetence = {
  competence: string;
  hierarchy: BoFaithfulHierarchy;
  tableTitle: string;
  columnName: string;
  tableFormat: BoTableFormat;
  sourceExcerpt: string;
  sortKey: number;
};

export type BoFaithfulTableReport = {
  tableTitle: string;
  tableFormat: BoTableFormat;
  columnName: string;
  competencesExtracted: number;
  warnings: string[];
};

export type BoFaithfulQualityReport = {
  introductionCharCount: number;
  structuredCharCount: number;
  totalCompetences: number;
  tablesDetected: number;
  tablesProcessed: number;
  competencesByMatiere: Record<string, number>;
  competencesBySousMatiere: Record<string, number>;
  competencesBySousSousMatiere: Record<string, number>;
  competencesByNiveau: Record<string, number>;
  tables: BoFaithfulTableReport[];
  warnings: string[];
  passed: boolean;
};

export type BoFaithfulExtractionResult = {
  introduction: string;
  structuredText: string;
  competences: BoFaithfulCompetence[];
  quality: BoFaithfulQualityReport;
  extractionMethod: "faithful_v1";
};
