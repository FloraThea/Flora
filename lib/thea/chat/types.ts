export type TheaChatMode = "chat" | "create_seance" | "create_sequence";

export type TheaCreateDraftInput = {
  matiere: string;
  objectif: string;
  niveau?: string;
  dureeMinutes?: number;
  sessionCount?: number;
  consignes?: string;
};

export type TheaAskRequest = {
  mode: TheaChatMode;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  createContext?: TheaCreateDraftInput;
};

export type TheaSeanceStructured = {
  title: string;
  competenceBo?: string;
  objectif: string;
  prerequis?: string[];
  materiel?: string[];
  dureeMinutes?: number;
  methode?: string;
  pedagogicalChoices?: string[];
  phases?: Array<{
    phaseKey: string;
    title?: string;
    dureeMinutes?: number;
    summary?: string;
    activities?: Array<{
      sortOrder?: number;
      objectif?: string;
      consignesEnseignant?: string;
      consignesEleves?: string;
      organisation?: string;
      dureeMinutes?: number;
      questions?: string[];
      reponsesAttendues?: string[];
      erreursFrequentes?: string[];
      remediations?: string[];
    }>;
  }>;
  evaluation?: {
    formative?: string;
    criteresReussite?: string[];
    observables?: string[];
    remediations?: string[];
  };
  differentiation?: {
    elevesFragiles?: string[];
    elevesAvances?: string[];
    groupesBesoins?: string[];
    adaptations?: string[];
    variantes?: string[];
  };
  traceEcrite?: {
    enseignant?: string;
    eleve?: string;
    lecon?: string;
    aideMemoire?: string;
  };
};

export type TheaSequenceStructured = {
  title: string;
  competenceBo?: string;
  objectifs?: string[];
  prerequis?: string[];
  notions?: string[];
  materiel?: string[];
  methode?: string;
  sessions?: Array<{
    sessionNumber?: number;
    title: string;
    objectif?: string;
    dureeMinutes?: number;
    placeProgression?: string;
  }>;
  evaluationFinale?: {
    label?: string;
    criteres?: string[];
  };
  differentiation?: {
    elevesEnDifficulte?: string[];
    elevesAvances?: string[];
    groupes?: string[];
    adaptations?: string[];
  };
};

export type TheaCreateStructured = TheaSeanceStructured | TheaSequenceStructured;

export type TheaAskResponse = {
  reply: string;
  mode: TheaChatMode;
  structured?: TheaCreateStructured | null;
  canSave?: boolean;
};

export type TheaSaveRequest = {
  mode: "create_seance" | "create_sequence";
  structured: TheaCreateStructured;
  createContext: TheaCreateDraftInput;
  referentielIds?: string[];
};

export type TheaSaveResponse = {
  type: "seance" | "sequence";
  id: string;
  title: string;
  href: string;
};

export type TheaChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: TheaChatMode;
  structured?: TheaCreateStructured | null;
  referentielIds?: string[];
  canSave?: boolean;
  saved?: {
    type: "seance" | "sequence";
    id: string;
    href: string;
    title: string;
  };
};
