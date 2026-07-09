/**
 * Inspection exhaustive des erreurs Supabase / HTTP — sans reformulation.
 */

export type InspectedError = {
  message: string;
  name?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  details?: string;
  hint?: string;
  stack?: string;
  httpResponse?: unknown;
  raw: unknown;
  json: string;
};

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pickRecord(error: unknown): Record<string, unknown> {
  if (typeof error !== "object" || error === null) {
    return { value: error };
  }
  return error as Record<string, unknown>;
}

export function inspectError(error: unknown): InspectedError {
  const record = pickRecord(error);

  const message =
    (typeof record.message === "string" && record.message) ||
    (error instanceof Error && error.message) ||
    safeJson(error);

  const httpResponse =
    record.response ??
    record.httpResponse ??
    record.originalError ??
    record.cause ??
    undefined;

  const inspected: InspectedError = {
    message,
    name: (record.name as string | undefined) ?? (error instanceof Error ? error.name : undefined),
    code: record.code as string | undefined,
    status: (record.status as number | undefined) ?? (record.statusCode as number | undefined),
    statusCode: (record.statusCode as number | undefined) ?? (record.status as number | undefined),
    details: record.details as string | undefined,
    hint: record.hint as string | undefined,
    stack: error instanceof Error ? error.stack : undefined,
    httpResponse,
    raw: error,
    json: safeJson({
      message,
      name: record.name ?? (error instanceof Error ? error.name : undefined),
      code: record.code,
      status: record.status ?? record.statusCode,
      statusCode: record.statusCode ?? record.status,
      details: record.details,
      hint: record.hint,
      httpResponse,
      ...(error instanceof Error ? { stack: error.stack } : {}),
      raw: typeof error === "object" ? { ...record } : error,
    }),
  };

  return inspected;
}

/** Message affiché tel quel — réponse Supabase brute, jamais reconstruite. */
export function getExactErrorMessage(error: unknown): string {
  return inspectError(error).message;
}

export function logInspectedError(label: string, error: unknown, context?: Record<string, unknown>): InspectedError {
  const inspected = inspectError(error);

  console.error(label, {
    context: context ?? {},
    error,
    "error.message": inspected.message,
    "error.statusCode": inspected.statusCode,
    "error.status": inspected.status,
    "error.name": inspected.name,
    "error.code": inspected.code,
    "error.details": inspected.details,
    "error.hint": inspected.hint,
    httpResponse: inspected.httpResponse,
    inspected: inspected.json,
  });

  return inspected;
}

export function throwExactError(
  error: unknown,
  context?: Record<string, unknown>,
  logLabel = "[supabase-error]",
): never {
  logInspectedError(logLabel, error, context);
  throw error instanceof Error ? error : new Error(inspectError(error).message);
}
