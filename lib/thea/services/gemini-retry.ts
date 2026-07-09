import "server-only";

import { GeminiExhaustedError, isGeminiTransientError } from "./gemini-errors";

export type GeminiRetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
  label?: string;
};

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_DELAY_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  options?: GeminiRetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const label = options?.label ?? "gemini";

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isGeminiTransientError(error)) {
        throw error;
      }

      if (attempt >= maxAttempts) {
        break;
      }

      console.warn(
        `[${label}] Serveur IA surchargé (503) — tentative ${attempt}/${maxAttempts}, nouvel essai dans ${delayMs / 1000}s`,
        error instanceof Error ? error.message : error,
      );

      await sleep(delayMs);
    }
  }

  throw new GeminiExhaustedError(lastError, maxAttempts);
}
