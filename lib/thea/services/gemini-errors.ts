import { ApiError } from "@google/genai";
import { GEMINI_QUEUE_USER_MESSAGE } from "../messages";

export function isGeminiTransientError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 503 || error.status === 429 || error.status === 500;
  }

  const message = error instanceof Error ? error.message : String(error);
  const upper = message.toUpperCase();

  return (
    upper.includes("503") ||
    upper.includes("429") ||
    upper.includes("UNAVAILABLE") ||
    upper.includes("RESOURCE_EXHAUSTED") ||
    upper.includes("OVERLOADED") ||
    upper.includes("HIGH DEMAND") ||
    upper.includes("TRY AGAIN")
  );
}

export class GeminiExhaustedError extends Error {
  readonly attempts: number;
  readonly cause: unknown;

  constructor(cause: unknown, attempts: number) {
    const detail =
      cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "Erreur Gemini";
    super(`Gemini indisponible après ${attempts} tentatives : ${detail}`);
    this.name = "GeminiExhaustedError";
    this.cause = cause;
    this.attempts = attempts;
  }
}
