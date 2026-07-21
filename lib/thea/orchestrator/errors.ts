import { ApiError } from "@google/genai";
import type { AiFallbackReason, AiProviderId } from "./types";

export function classifyAiError(error: unknown): { transient: boolean; reason: AiFallbackReason } {
  if (error instanceof Error && error.name === "AbortError") {
    return { transient: true, reason: "timeout" };
  }

  if (error instanceof ApiError) {
    if (error.status === 429) {
      const message = error.message.toUpperCase();
      return {
        transient: true,
        reason: message.includes("QUOTA") || message.includes("RESOURCE_EXHAUSTED")
          ? "quota_exceeded"
          : "unavailable",
      };
    }
    if (error.status === 503 || error.status === 500) {
      return { transient: true, reason: "unavailable" };
    }
    return { transient: false, reason: "api_error" };
  }

  const message = error instanceof Error ? error.message : String(error);
  const upper = message.toUpperCase();

  if (upper.includes("TIMEOUT") || upper.includes("ETIMEDOUT") || upper.includes("ABORT")) {
    return { transient: true, reason: "timeout" };
  }

  if (
    upper.includes("429") ||
    upper.includes("QUOTA") ||
    upper.includes("RESOURCE_EXHAUSTED") ||
    upper.includes("RATE LIMIT")
  ) {
    return { transient: true, reason: "quota_exceeded" };
  }

  if (
    upper.includes("503") ||
    upper.includes("500") ||
    upper.includes("UNAVAILABLE") ||
    upper.includes("OVERLOADED") ||
    upper.includes("HIGH DEMAND") ||
    upper.includes("TRY AGAIN")
  ) {
    return { transient: true, reason: "unavailable" };
  }

  return { transient: false, reason: "api_error" };
}

export function isAiTransientError(error: unknown): boolean {
  return classifyAiError(error).transient;
}

/** @deprecated Utiliser isAiTransientError */
export const isGeminiTransientError = isAiTransientError;

export class AiExhaustedError extends Error {
  readonly attempts: number;
  readonly cause: unknown;
  readonly providersTried: AiProviderId[];

  constructor(cause: unknown, attempts: number, providersTried: AiProviderId[] = []) {
    const detail =
      cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "Erreur IA";
    super(`IA indisponible après ${attempts} tentative(s) : ${detail}`);
    this.name = "AiExhaustedError";
    this.cause = cause;
    this.attempts = attempts;
    this.providersTried = providersTried;
  }
}

/** Alias rétrocompatible — import documentaire et routes API existantes. */
export class GeminiExhaustedError extends AiExhaustedError {
  constructor(cause: unknown, attempts: number, providersTried: AiProviderId[] = []) {
    super(cause, attempts, providersTried);
    this.name = "GeminiExhaustedError";
  }
}
