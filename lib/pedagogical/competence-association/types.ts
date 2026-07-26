export type PedagogicalEntityType =
  | "programmation"
  | "programming_cell"
  | "progression_row"
  | "sequence"
  | "seance"
  | "module"
  | "import";

export type PedagogicalContentInput = {
  entityType: PedagogicalEntityType;
  entityId?: string;
  title?: string;
  theme?: string;
  matiere: string;
  niveau?: string;
  cycle?: string;
  sousMatiere?: string;
  methode?: string;
  objectifs?: string[];
  competences?: string[];
  notions?: string[];
  deroulement?: string;
  activites?: string[];
  materiel?: string[];
  ressources?: string[];
  moduleLabel?: string;
  seanceLabel?: string;
  libraryContent?: string;
  evaluation?: string;
  differenciation?: string;
};

export type ContentProfile = {
  fullText: string;
  weightedSegments: Array<{ text: string; weight: number; label: string }>;
  contentHash: string;
  tokens: string[];
  bigrams: string[];
};

export type BoCompetenceCandidate = {
  id: string;
  competence: string;
  code: string | null;
  discipline: string | null;
  domaine: string | null;
  sousDomaine: string | null;
  niveau: string | null;
  cycle: string | null;
  section: string | null;
  sourceExcerpt: string | null;
  documentSourceId: string | null;
};

export type AssociationSignals = {
  textSimilarity: number;
  hierarchyMatch: number;
  explicitLabel: number;
  methodContext: number;
  feedbackBoost: number;
};

export type CompetenceAssociationProposal = {
  referentielId: string;
  competenceText: string;
  confidence: number;
  rank: number;
  explanation: string;
  signals: AssociationSignals;
  hierarchy: {
    cycle: string;
    niveau: string;
    matiere: string;
    sousMatiere: string;
    sousSousMatiere: string;
  };
  status: "high" | "medium" | "low";
};

export type CompetenceAssociationResult = {
  proposals: CompetenceAssociationProposal[];
  primary: CompetenceAssociationProposal | null;
  contentProfile: Pick<ContentProfile, "contentHash" | "fullText">;
  candidateCount: number;
  filteredCount: number;
};

export type CompetenceFeedbackAction = "accepted" | "rejected" | "replaced" | "added" | "removed";

export type CompetenceFeedbackInput = {
  teacherProfileId: string;
  entityType: PedagogicalEntityType;
  entityId?: string;
  contentHash: string;
  matiere?: string;
  niveau?: string;
  methode?: string;
  proposedReferentielId?: string | null;
  finalReferentielId?: string | null;
  action: CompetenceFeedbackAction;
  confidence?: number;
  metadata?: Record<string, unknown>;
};
