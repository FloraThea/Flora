import { NextResponse } from "next/server";
import { logStructuredError, serializeError } from "@/lib/api/error-diagnostics";
import { devLog } from "@/lib/logger";
import { getSupabaseErrorMessage, isSupabaseError } from "@/lib/supabase-errors";

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (isSupabaseError(error)) {
    return getSupabaseErrorMessage(error, "Erreur base de données");
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Erreur inconnue";
  }
}

export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

export type RouteErrorBody = {
  route: string;
  error: string;
  details?: string;
  [key: string]: unknown;
};

export function jsonRouteError(
  route: string,
  status: number,
  error: string,
  details?: string,
  extra?: Record<string, unknown>,
  cause?: unknown,
) {
  logStructuredError(route, "Erreur route API", {
    route,
    status,
    error,
    details,
    ...extra,
  }, cause);

  return NextResponse.json(
    {
      route,
      error,
      ...(details ? { details } : {}),
      ...extra,
      ...(cause !== undefined
        ? { cause: serializeError(cause) }
        : {}),
    } satisfies RouteErrorBody,
    { status },
  );
}

export function logRouteInfo(route: string, message: string, meta?: Record<string, unknown>) {
  devLog(`[${route}] ${message}`, meta ?? {});
}
