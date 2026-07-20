export const TRASH_RETENTION_DAYS = 30;

export type TrashEntityType = "programmation" | "progression" | "sequence" | "seance";

export type TrashItem = {
  id: string;
  entityType: TrashEntityType;
  title: string;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  periode: string;
  status: string;
  deletedAt: string;
  purgeAfter: string;
  daysRemaining: number;
  dependencySummary: string[];
  parentId: string | null;
  parentType: TrashEntityType | null;
  parentTitle: string | null;
  parentInTrash: boolean;
};

export type TrashRestoreMode = "entity_only" | "with_parent";

export type TrashListFilter = {
  entityType?: TrashEntityType | "all";
  matiere?: string;
  deletedAfter?: string;
};

export type SimilarDocument = {
  id: string;
  entityType: TrashEntityType;
  title: string;
  matiere: string;
  sousMatiere: string;
  createdAt: string;
};
