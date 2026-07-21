import { classifyAiError } from "./errors";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withProviderRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    delayMs: number;
    label: string;
    providerId: string;
  },
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const { transient } = classifyAiError(error);

      if (!transient || attempt >= options.maxAttempts) {
        throw error;
      }

      console.warn(
        `[ai-orchestrator] ${options.providerId} transient — tentative ${attempt}/${options.maxAttempts}, nouvel essai dans ${options.delayMs / 1000}s`,
        error instanceof Error ? error.message : error,
      );

      await sleep(options.delayMs);
    }
  }

  throw lastError;
}
