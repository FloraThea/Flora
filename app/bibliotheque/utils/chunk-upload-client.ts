import { formatBytes, IMPORT_CONFIG, MAX_UPLOAD_SIZE, validateUploadFileSize } from "@/lib/documents/import/config";
import type { DuplicateResolution, UploadProgress } from "@/lib/documents/import/types";
import type { FloraDocument } from "@/lib/documents/types";

export type ChunkUploadResultPayload = {
  success?: boolean;
  error?: string;
  sessionId?: string;
  documentId?: string;
  jobId?: string;
  duplicateDetected?: boolean;
  duplicateCandidates?: FloraDocument[];
  message?: string;
  progress?: UploadProgress;
};

export type ImportStatusPayload = {
  job?: {
    id: string;
    status: string;
    progress: number;
    stageLabel: string;
    errorMessage?: string;
  } | null;
  notifications?: Array<{ id: string; message: string; type: string }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type R2EnvPresence = Record<string, "present" | "missing">;

type ImportApiErrorPayload = {
  route?: string;
  error?: string;
  details?: string;
  step?: string;
  stepLabel?: string;
  supabase?: string;
  restartHint?: string | null;
  missingEnv?: string[];
  r2Env?: R2EnvPresence;
  bucket?: string | null;
  endpoint?: string | null;
  storageKey?: string | null;
  cause?: {
    message?: string;
    name?: string;
  };
  context?: {
    bucket?: string;
    storagePath?: string;
    fileSizeBytes?: number;
    contentType?: string;
    fileName?: string;
    sessionId?: string;
    documentId?: string;
    jobId?: string;
    table?: string;
    extra?: {
      missingEnv?: string[];
      provider?: string;
      operation?: string;
      userId?: string;
    };
  };
};

type ParsedImportApiResponse<T> = {
  ok: boolean;
  status: number;
  url: string;
  payload: T & ImportApiErrorPayload;
  rawBody: string;
  parseError?: string;
};

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function extractExactErrorMessage(payload: ImportApiErrorPayload): string {
  const candidates = [
    payload.error,
    payload.cause?.message,
    payload.details,
    payload.restartHint,
  ];

  for (const candidate of candidates) {
    const cleaned = stripAnsi(String(candidate ?? "")).trim();
    if (cleaned) return cleaned;
  }

  return "";
}

function formatMissingEnvLines(payload: ImportApiErrorPayload): string[] {
  if (payload.r2Env) {
    return Object.entries(payload.r2Env).map(
      ([key, value]) => `- ${key} : ${value === "present" ? "présente" : "manquante"}`,
    );
  }

  if (payload.missingEnv?.length) {
    return payload.missingEnv.map((key) => `- ${key} : manquante`);
  }

  if (payload.context?.extra?.missingEnv?.length) {
    return payload.context.extra.missingEnv.map((key) => `- ${key} : manquante`);
  }

  return [];
}

export function formatImportApiError(
  payload: ImportApiErrorPayload,
  meta?: { url?: string; status?: number },
): string {
  const message = extractExactErrorMessage(payload);
  const ctx = payload.context;
  const contextLines: string[] = [];

  if (meta?.url) contextLines.push(`URL : ${meta.url}`);
  if (meta?.status) contextLines.push(`HTTP ${meta.status}`);
  if (message) contextLines.push(`Message : ${message}`);

  const step =
    payload.stepLabel ??
    (payload.step ? `Étape : ${payload.step}` : null);
  if (step) contextLines.push(typeof step === "string" && step.startsWith("Étape") ? step : `Étape : ${step}`);

  if (ctx?.fileName) contextLines.push(`Fichier : ${ctx.fileName}`);
  if (payload.storageKey || ctx?.storagePath) {
    contextLines.push(`Clé R2 : ${payload.storageKey ?? ctx?.storagePath}`);
  }
  if (payload.bucket || ctx?.bucket) {
    contextLines.push(`Bucket : ${payload.bucket ?? ctx?.bucket}`);
  }
  if (payload.endpoint) contextLines.push(`Endpoint R2 : ${payload.endpoint}`);
  if (typeof ctx?.fileSizeBytes === "number") {
    contextLines.push(`Taille : ${formatBytes(ctx.fileSizeBytes)}`);
  }
  if (ctx?.contentType) contextLines.push(`Type MIME : ${ctx.contentType}`);

  const envLines = formatMissingEnvLines(payload);
  if (envLines.length) {
    contextLines.push(["Variables R2 :", ...envLines].join("\n"));
  }

  if (payload.restartHint) {
    contextLines.push(String(payload.restartHint));
  }

  const technicalDetails = payload.details ?? payload.supabase;
  if (technicalDetails && technicalDetails !== message) {
    contextLines.push(`Détails API :\n${technicalDetails}`);
  }

  return contextLines.filter(Boolean).join("\n\n");
}

async function parseImportApiResponse<T>(
  response: Response,
  url: string,
): Promise<ParsedImportApiResponse<T>> {
  const rawBody = await response.text();
  let payload = {} as T & ImportApiErrorPayload;
  let parseError: string | undefined;

  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody) as T & ImportApiErrorPayload;
    } catch (error) {
      parseError = error instanceof Error ? error.message : "JSON invalide";
      payload = {
        error: rawBody.slice(0, 2000),
      } as T & ImportApiErrorPayload;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    url,
    payload,
    rawBody,
    parseError,
  };
}

function logImportApiFailure(parsed: ParsedImportApiResponse<unknown>): void {
  console.error("[import] Réponse API en erreur", {
    url: parsed.url,
    status: parsed.status,
    parseError: parsed.parseError ?? null,
    message: extractExactErrorMessage(parsed.payload),
    step: parsed.payload.step ?? null,
    stepLabel: parsed.payload.stepLabel ?? null,
    bucket: parsed.payload.bucket ?? parsed.payload.context?.bucket ?? null,
    endpoint: parsed.payload.endpoint ?? null,
    storageKey: parsed.payload.storageKey ?? parsed.payload.context?.storagePath ?? null,
    r2Env: parsed.payload.r2Env ?? null,
    missingEnv: parsed.payload.missingEnv ?? parsed.payload.context?.extra?.missingEnv ?? null,
    payload: parsed.payload,
    rawBodyPreview: parsed.rawBody.slice(0, 4000),
  });
}

function throwImportApiError(parsed: ParsedImportApiResponse<unknown>): never {
  logImportApiFailure(parsed);

  const formatted = formatImportApiError(parsed.payload, {
    url: parsed.url,
    status: parsed.status,
  });

  throw new Error(
    formatted ||
      `Requête impossible (${parsed.status}) sur ${parsed.url}`,
  );
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const parsed = await parseImportApiResponse<T>(response, url);
  if (!parsed.ok) {
    throwImportApiError(parsed);
  }

  return parsed.payload;
}

async function uploadChunkWithRetry(input: {
  sessionId: string;
  chunkIndex: number;
  blob: Blob;
  totalChunks: number;
}): Promise<UploadProgress> {
  let lastError: Error | null = null;
  const url = "/api/documents/import/chunk";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const formData = new FormData();
      formData.append("sessionId", input.sessionId);
      formData.append("chunkIndex", String(input.chunkIndex));
      formData.append("chunk", input.blob, `chunk-${input.chunkIndex}`);

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const parsed = await parseImportApiResponse<ChunkUploadResultPayload>(response, url);
      if (!parsed.ok) {
        throwImportApiError(parsed);
      }

      return parsed.payload.progress ?? {
        percent: 0,
        uploadedBytes: 0,
        totalBytes: 0,
        remainingBytes: 0,
        speedBytesPerSecond: 0,
        estimatedSecondsRemaining: null,
        label: "Envoi en cours…",
        stage: "upload",
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Envoi impossible.");
      await sleep(800 * (attempt + 1));
    }
  }

  throw lastError ?? new Error("Envoi du morceau impossible.");
}

export async function uploadDocumentWithChunks(
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<ChunkUploadResultPayload> {
  validateUploadFileSize(file.size, file.name);

  const startedAtMs = Date.now();

  onProgress({
    percent: 2,
    uploadedBytes: 0,
    totalBytes: file.size,
    remainingBytes: file.size,
    speedBytesPerSecond: 0,
    estimatedSecondsRemaining: null,
    label: "Préparation de l'import…",
    stage: "preparation",
  });

  const init = await postJson<{
    sessionId: string;
    chunkSize: number;
    totalChunks: number;
    useChunkUpload: boolean;
    maxFileSize: number;
    storageProvider?: string;
  }>("/api/documents/import/init", {
    filename: file.name,
    fileSize: file.size,
    contentType: file.type,
  });

  onProgress({
    percent: 5,
    uploadedBytes: 0,
    totalBytes: file.size,
    remainingBytes: file.size,
    speedBytesPerSecond: 0,
    estimatedSecondsRemaining: null,
    label: `Upload vers Cloudflare R2 (${init.storageProvider ?? "cloudflare_r2"})…`,
    stage: "upload",
  });

  const chunkSize = init.chunkSize;
  const totalChunks = init.totalChunks;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const blob = file.slice(start, end);

    await uploadChunkWithRetry({
      sessionId: init.sessionId,
      chunkIndex,
      blob,
      totalChunks,
    });

    const uploadedBytes = Math.min(file.size, (chunkIndex + 1) * chunkSize);
    const elapsedSeconds = Math.max(0.001, (Date.now() - startedAtMs) / 1000);
    const speedBytesPerSecond = Math.round(uploadedBytes / elapsedSeconds);
    const remainingBytes = Math.max(0, file.size - uploadedBytes);
    const estimatedSecondsRemaining =
      speedBytesPerSecond > 0 && remainingBytes > 0
        ? Math.min(86400, Math.ceil(remainingBytes / speedBytesPerSecond))
        : null;

    onProgress({
      percent: Math.min(95, Math.round((uploadedBytes / file.size) * 90) + 5),
      uploadedBytes,
      totalBytes: file.size,
      remainingBytes,
      speedBytesPerSecond,
      estimatedSecondsRemaining,
      label: `Import de ${file.name}`,
      stage: "upload",
    });
  }

  console.info("[import] Upload navigateur terminé", {
    fileName: file.name,
    fileSizeBytes: file.size,
    fileSizeLabel: formatBytes(file.size),
    allowedLimitBytes: MAX_UPLOAD_SIZE,
    allowedLimitLabel: formatBytes(MAX_UPLOAD_SIZE),
  });

  onProgress({
    percent: 96,
    uploadedBytes: file.size,
    totalBytes: file.size,
    remainingBytes: 0,
    speedBytesPerSecond: Math.round(file.size / Math.max(0.001, (Date.now() - startedAtMs) / 1000)),
    estimatedSecondsRemaining: null,
    label: "Vérification et finalisation R2…",
    stage: "verification",
  });

  console.info("[import] Finalisation multipart Cloudflare R2", {
    sessionId: init.sessionId,
    storageProvider: init.storageProvider ?? "cloudflare_r2",
    fileSizeBytes: file.size,
    fileSizeLabel: formatBytes(file.size),
  });

  const complete = await postJson<ChunkUploadResultPayload>("/api/documents/import/complete", {
    sessionId: init.sessionId,
  });

  if (complete.duplicateDetected) {
    return complete;
  }

  return {
    ...complete,
    message:
      complete.message ||
      "Votre document est en cours d'analyse… Vous pouvez continuer à utiliser Flora pendant ce temps.",
  };
}

export async function resolveDuplicateImport(input: {
  sessionId: string;
  resolution: DuplicateResolution;
}): Promise<ChunkUploadResultPayload> {
  return postJson<ChunkUploadResultPayload>("/api/documents/import/duplicate-resolve", input);
}

export async function pollImportStatus(documentId: string, jobId?: string): Promise<ImportStatusPayload> {
  const params = new URLSearchParams({ documentId });
  if (jobId) params.set("jobId", jobId);
  const url = `/api/documents/import/status?${params.toString()}`;

  const response = await fetch(url);
  const parsed = await parseImportApiResponse<ImportStatusPayload>(response, url);

  if (!parsed.ok) {
    throwImportApiError(parsed);
  }

  return parsed.payload;
}

export function formatUploadProgressLine(progress: UploadProgress): string {
  return `${formatBytes(progress.uploadedBytes)} / ${formatBytes(progress.totalBytes)}`;
}

export function formatUploadEta(progress: UploadProgress): string | null {
  const eta = progress.estimatedSecondsRemaining;
  if (eta === null || eta <= 0 || eta > 86400) return null;
  return `Temps restant : ${eta} seconde${eta > 1 ? "s" : ""}`;
}

export const IMPORT_POLL_INTERVAL_MS = IMPORT_CONFIG.pollIntervalMs;
export { MAX_UPLOAD_SIZE, formatBytes, validateUploadFileSize };
