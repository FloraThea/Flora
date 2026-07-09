export type UploadPhase =
  | "idle"
  | "uploading"
  | "analyzing"
  | "success"
  | "warning"
  | "error";

export type UploadState = {
  phase: UploadPhase;
  progress: number;
  statusLabel: string;
  message: string | null;
  error: string | null;
};

export type ImportPayload = {
  success: boolean;
  documentId: string;
  jobId?: string;
  message?: string;
  warning?: string;
  error?: string;
};

export const initialUploadState: UploadState = {
  phase: "idle",
  progress: 0,
  statusLabel: "",
  message: null,
  error: null,
};

export type FilterValues = {
  type: string;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  cycle: string;
  methode: string;
};

export const initialFilterValues: FilterValues = {
  type: "Tous",
  matiere: "Toutes",
  sousMatiere: "Toutes",
  niveau: "Tous",
  cycle: "Tous",
  methode: "Toutes",
};

export type FilterOptions = Record<keyof FilterValues, string[]>;
