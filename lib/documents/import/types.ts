import type { FloraDocument } from "../types";

export type UploadSessionStatus =
  | "pending"
  | "uploading"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

export type ImportJobStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "ocr"
  | "analyzing"
  | "indexing"
  | "completed"
  | "failed"
  | "paused"
  | "cancelled"
  | "waiting_ai";

export type DuplicateResolution = "replace" | "new_version" | "keep_both" | "merge";

export type ImportProgressStage =
  | "preparation"
  | "upload"
  | "verification"
  | "analysis"
  | "indexing"
  | "completed";

export type UploadProgress = {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  speedBytesPerSecond: number;
  estimatedSecondsRemaining: number | null;
  label: string;
  stage: ImportProgressStage;
};

export type UploadSession = {
  id: string;
  originalFilename: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunkIndexes: number[];
  storagePath: string;
  documentId: string | null;
  status: UploadSessionStatus;
  createdAt: string;
};

export type ImportJob = {
  id: string;
  documentId: string;
  sessionId: string | null;
  status: ImportJobStatus;
  queuePosition: number;
  progress: number;
  stageLabel: string;
  errorMessage: string;
  paused: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ImportStatusPayload = {
  session: UploadSession | null;
  job: ImportJob | null;
  document: FloraDocument | null;
  notifications: ImportNotification[];
  duplicateCandidates?: FloraDocument[];
};

export type ImportNotification = {
  id: string;
  documentId: string | null;
  jobId: string | null;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export type InitUploadInput = {
  filename: string;
  fileSize: number;
  contentType?: string;
  checksum?: string;
};

export type InitUploadResult = {
  sessionId: string;
  chunkSize: number;
  totalChunks: number;
  maxFileSize: number;
  useChunkUpload: boolean;
  storagePath: string;
  storageProvider?: string;
};

export type CompleteUploadInput = {
  sessionId: string;
  checksum?: string;
  duplicateResolution?: DuplicateResolution;
};

export type CompleteUploadResult = {
  sessionId: string;
  documentId: string;
  jobId: string;
  duplicateDetected: boolean;
  message: string;
};

export type ChunkUploadResult = {
  sessionId: string;
  chunkIndex: number;
  uploadedChunks: number;
  totalChunks: number;
  progress: UploadProgress;
};

export type DocumentMetadataDraft = {
  title: string;
  auteur: string;
  editeur: string;
  niveau: string;
  cycle: string;
  discipline: string;
  methode: string;
  annee: string;
  langue: string;
  pageCount: number | null;
  imageCount: number;
  tableCount: number;
  documentType: string;
};
