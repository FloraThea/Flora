export type DeroulementStep = {
  key: string;
  label: string;
  content: string;
};

export const PREPARATION_DEROULEMENT_STEPS: Array<{ key: string; label: string }> = [
  { key: "mise_en_situation", label: "Mise en situation" },
  { key: "recherche", label: "Recherche" },
  { key: "mise_en_commun", label: "Mise en commun" },
  { key: "entrainement", label: "Entraînement" },
  { key: "institutionnalisation", label: "Institutionnalisation" },
  { key: "reinvestissement", label: "Réinvestissement" },
];

export type SessionPreparationDetail = {
  competences: string[];
  referentielIds: string[];
  deroulement: DeroulementStep[];
  materiel: string[];
  resources: string[];
  resourceIds: string[];
};

export type SequenceSessionFormValues = {
  sessionNumber: number;
  title: string;
  objectif: string;
  dureeMinutes: number;
  competences: string[];
  referentielIds: string[];
  deroulement: DeroulementStep[];
  materiel: string[];
  resources: string[];
  resourceIds: string[];
};

export type SeancePreparationFormValues = {
  title: string;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  cycle: string;
  sessionDate: string;
  dureeMinutes: number;
  competences: string[];
  referentielIds: string[];
  objectif: string;
  deroulement: DeroulementStep[];
  materiel: string[];
  resources: string[];
  resourceIds: string[];
};

export type SequencePreparationFormValues = {
  title: string;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  cycle: string;
  competences: string[];
  referentielIds: string[];
  objectifGeneral: string;
  deroulementGeneral: DeroulementStep[];
  materiel: string[];
  resources: string[];
  resourceIds: string[];
  sessions: SequenceSessionFormValues[];
};

export type ReferentielOption = {
  id: string;
  competence: string;
  domaine: string | null;
  code: string | null;
  niveau: string | null;
};

export type ReferentielOptionsPayload = {
  domaines: string[];
  competences: ReferentielOption[];
};

export type LibraryResourceOption = {
  id: string;
  title: string;
  discipline: string;
  category: string;
  format: string;
};
