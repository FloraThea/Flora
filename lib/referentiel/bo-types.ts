export type BoDocumentStatus =
  | "UPLOADED"
  | "TEXT_EXTRACTED"
  | "ANALYZING"
  | "ANALYZED"
  | "VALIDATED"
  | "READY"
  | "ERROR";

export type BoCompetenceType =
  | "attendu"
  | "competence"
  | "connaissance"
  | "exemple"
  | "progressivite"
  | "autre";

export type BoSectionId =
  | "francais"
  | "langage_oral"
  | "lecture"
  | "ecriture"
  | "etude_langue"
  | "culture_litteraire"
  | "evar_intro"
  | "evar_organisation"
  | "evar_contenus"
  | "evar_niveaux";

export type BoSectionDefinition = {
  id: BoSectionId;
  label: string;
  anchors: string[];
};

export const BO_FRANCAIS_SECTIONS: BoSectionDefinition[] = [
  {
    id: "francais",
    label: "Français",
    anchors: ["Programme de français", "Principes", "Fréquence des temps"],
  },
  {
    id: "langage_oral",
    label: "Langage oral",
    anchors: ["Langage oral", "LANGAGE ORAL", "Parler en continu", "Parler en interaction"],
  },
  {
    id: "lecture",
    label: "Lecture et compréhension de l'écrit",
    anchors: [
      "Lecture et compréhension",
      "Lecture",
      "Lire à voix haute",
      "Comprendre un texte",
      "Devenir lecteur",
    ],
  },
  {
    id: "ecriture",
    label: "Écriture",
    anchors: ["Écriture", "ECRITURE", "Production d'écrits", "Produire des écrits"],
  },
  {
    id: "etude_langue",
    label: "Étude de la langue",
    anchors: [
      "Étude de la langue",
      "ETUDE DE LA LANGUE",
      "Grammaire",
      "Orthographe",
      "Conjugaison",
      "Vocabulaire",
    ],
  },
  {
    id: "culture_litteraire",
    label: "Culture littéraire et artistique",
    anchors: [
      "Culture littéraire",
      "Culture littéraire et artistique",
      "Poésie",
      "Littérature",
    ],
  },
];

export type BoSectionChunk = {
  id: BoSectionId;
  label: string;
  text: string;
  charStart: number;
  charEnd: number;
};

export type BoCompetenceDraft = {
  cycle: string;
  niveau: string;
  matiere: string;
  section: string;
  sectionId: BoSectionId;
  domaine: string;
  sousDomaine: string;
  competenceType: BoCompetenceType;
  competence: string;
  sousCompetence: string;
  sourceExcerpt: string;
  code: string;
};

export type BoValidationReport = {
  totalCompetences: number;
  sectionsDetected: string[];
  sectionsMissing: string[];
  competencesBySection: Record<string, number>;
  competencesByType: Record<string, number>;
  warnings: string[];
  probableMissing: string[];
};

export type BoDocumentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  teacher_profile_id?: string | null;
  original_filename: string;
  storage_path: string;
  file_extension: string;
  file_size: number;
  cycle: string;
  matiere: string;
  domaine: string;
  niveau?: string;
  extracted_text: string;
  text_length: number;
  page_count: number | null;
  extraction_method: string;
  error_message?: string;
  document_type?: string;
  storage_url?: string;
  original_name?: string;
  status: BoDocumentStatus;
  active_for_programmation: boolean;
  validation: BoValidationReport | Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type BoImportResult = {
  document: BoDocumentRow;
  competences: BoCompetenceDraft[];
  validation: BoValidationReport;
  insertedCount: number;
  sectionsProcessed: string[];
  storageWarning?: string | null;
  pdfArchived?: boolean;
  storageBucket?: string;
  savedToLibrary?: boolean;
};
