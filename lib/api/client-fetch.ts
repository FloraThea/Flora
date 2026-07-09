import {
  describeRequestPayload,
  headersToRecord,
  logStructuredError,
  resolveRequestUrl,
  serializeError,
} from "@/lib/api/error-diagnostics";

export async function readResponseBody(response: Response): Promise<{
  parsed: unknown;
  raw: string;
}> {
  const raw = await response.text();
  if (!raw) {
    return { parsed: null, raw: "" };
  }

  try {
    return { parsed: JSON.parse(raw), raw };
  } catch {
    return { parsed: null, raw };
  }
}

export function getApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.error === "string") return candidate.error;
  if (typeof candidate.message === "string") return candidate.message;
  return null;
}

export type ApiFetchDiagnostics = {
  label: string;
  route: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  rawBody?: string;
  parsedBody?: unknown;
  requestPayload?: unknown;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  textLength?: number;
};

export type FetchApiContext = {
  label: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  textLength?: number;
};

export class ApiFetchDiagnosticError extends Error {
  diagnostics: ApiFetchDiagnostics;

  constructor(message: string, diagnostics: ApiFetchDiagnostics) {
    super(message);
    this.name = "ApiFetchDiagnosticError";
    this.diagnostics = diagnostics;
  }
}

function buildFailureMessage(diagnostics: ApiFetchDiagnostics): string {
  const parts = [
    `[route=${diagnostics.route}]`,
    `[method=${diagnostics.method}]`,
    `[url=${diagnostics.url}]`,
  ];

  if (diagnostics.status !== undefined) {
    parts.push(`[status=${diagnostics.status} ${diagnostics.statusText ?? ""}]`.trim());
  }

  const apiMessage = getApiErrorMessage(diagnostics.parsedBody);
  if (apiMessage) {
    parts.push(`[api=${apiMessage}]`);
  }

  if (diagnostics.parsedBody && typeof diagnostics.parsedBody === "object") {
    const details = (diagnostics.parsedBody as Record<string, unknown>).details;
    if (typeof details === "string") {
      parts.push(`[details=${details}]`);
    }
  }

  parts.push(`[body=${diagnostics.rawBody || "<vide>"}]`);

  if (diagnostics.fileName) {
    parts.push(`[file=${diagnostics.fileName}]`);
  }

  if (diagnostics.fileSize !== undefined) {
    parts.push(`[fileSize=${diagnostics.fileSize}]`);
  }

  return parts.join(" ");
}

export async function fetchApiWithDiagnostics<T = unknown>(
  route: string,
  init: RequestInit,
  context: FetchApiContext | string,
): Promise<T> {
  const label = typeof context === "string" ? context : context.label;
  const method = init.method ?? "GET";
  const url = resolveRequestUrl(route);
  const requestPayload = describeRequestPayload(init.body);

  const baseDiagnostics: ApiFetchDiagnostics = {
    label,
    route,
    method,
    url,
    requestPayload,
    ...(typeof context === "object"
      ? {
          fileName: context.fileName,
          fileSize: context.fileSize,
          fileType: context.fileType,
          textLength: context.textLength,
        }
      : {}),
  };

  console.info(`[${label}] Appel API`, {
    route,
    method,
    url,
    requestPayload,
    fileName: baseDiagnostics.fileName,
    fileSize: baseDiagnostics.fileSize,
    fileType: baseDiagnostics.fileType,
    textLength: baseDiagnostics.textLength,
  });

  let response: Response;

  try {
    response = await fetch(route, init);
  } catch (error) {
    logStructuredError(label, "Echec réseau fetch", baseDiagnostics, error);
    throw new ApiFetchDiagnosticError(
      `[route=${route}] [method=${method}] [url=${url}] Echec réseau: ${serializeError(error).message}`,
      baseDiagnostics,
    );
  }

  const responseHeaders = headersToRecord(response.headers);
  const { parsed, raw } = await readResponseBody(response);

  const responseDiagnostics: ApiFetchDiagnostics = {
    ...baseDiagnostics,
    status: response.status,
    statusText: response.statusText,
    responseHeaders,
    rawBody: raw,
    parsedBody: parsed,
  };

  if (!response.ok) {
    const message = buildFailureMessage(responseDiagnostics);
    logStructuredError(label, "Echec API HTTP", responseDiagnostics);
    throw new ApiFetchDiagnosticError(message, responseDiagnostics);
  }

  if (parsed === null) {
    const message = `[route=${route}] [method=${method}] [url=${url}] [status=${response.status}] Réponse non JSON [body=${raw || "<vide>"}]`;
    logStructuredError(label, "Réponse API invalide", responseDiagnostics);
    throw new ApiFetchDiagnosticError(message, responseDiagnostics);
  }

  console.info(`[${label}] Réponse API OK`, {
    route,
    method,
    url,
    status: response.status,
    statusText: response.statusText,
    responseHeaders,
    parsedBody: parsed,
  });

  return parsed as T;
}
