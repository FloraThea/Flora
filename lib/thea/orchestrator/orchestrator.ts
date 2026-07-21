import { AI_ORCHESTRATOR_CONFIG } from "./config";
import { AiExhaustedError, classifyAiError } from "./errors";
import { logAiAttempt, logAiFallback, logAiSuccess } from "./logger";
import { resolveProviderChain } from "./providers/registry";
import { enqueueAiRequest } from "./queue";
import { withProviderRetry } from "./retry";
import type {
  AiCompletionRequest,
  AiCompletionResult,
  AiFallbackReason,
  AiProvider,
  AiProviderId,
} from "./types";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Timeout IA après ${timeoutMs}ms`), { name: "AbortError" }));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function runProvider(
  provider: AiProvider,
  prompt: string,
  options: {
    label: string;
    maxAttempts: number;
    delayMs: number;
    fallbackFrom?: AiProviderId;
    fallbackReason?: AiFallbackReason;
  },
): Promise<AiCompletionResult> {
  const started = Date.now();

  const text = await withProviderRetry(
    () =>
      withTimeout(
        provider.complete(prompt, {
          signal: AbortSignal.timeout(AI_ORCHESTRATOR_CONFIG.providerTimeoutMs),
        }),
        AI_ORCHESTRATOR_CONFIG.providerTimeoutMs + 2_000,
      ),
    {
      maxAttempts: options.maxAttempts,
      delayMs: options.delayMs,
      label: options.label,
      providerId: provider.id,
    },
  );

  const meta = {
    providerId: provider.id,
    model: provider.model,
    durationMs: Date.now() - started,
    fallbackFrom: options.fallbackFrom,
    fallbackReason: options.fallbackReason,
    attempt: options.maxAttempts,
  };

  logAiSuccess({ label: options.label, ...meta });
  return { text, meta };
}

async function completeWithProviders(request: AiCompletionRequest): Promise<AiCompletionResult> {
  const label = request.label ?? "thea";
  const chain = resolveProviderChain();

  if (chain.length === 0) {
    throw new AiExhaustedError(new Error("Aucun fournisseur IA configuré."), 0, []);
  }

  const providersTried: AiProviderId[] = [];
  let lastError: unknown;
  let lastReason: AiFallbackReason = "provider_exhausted";

  for (let index = 0; index < chain.length; index++) {
    const provider = chain[index];
    const isPrimary = index === 0;
    const previous = index > 0 ? chain[index - 1] : undefined;

    providersTried.push(provider.id);

    logAiAttempt({
      label,
      providerId: provider.id,
      model: provider.model,
      attempt: 1,
      maxAttempts: isPrimary
        ? AI_ORCHESTRATOR_CONFIG.primaryMaxAttempts
        : AI_ORCHESTRATOR_CONFIG.fallbackMaxAttempts,
      fallbackFrom: previous?.id,
      fallbackReason: previous ? lastReason : undefined,
    });

    try {
      return await runProvider(provider, request.prompt, {
        label,
        maxAttempts: isPrimary
          ? AI_ORCHESTRATOR_CONFIG.primaryMaxAttempts
          : AI_ORCHESTRATOR_CONFIG.fallbackMaxAttempts,
        delayMs: isPrimary
          ? AI_ORCHESTRATOR_CONFIG.primaryRetryDelayMs
          : AI_ORCHESTRATOR_CONFIG.fallbackRetryDelayMs,
        fallbackFrom: previous?.id,
        fallbackReason: previous ? lastReason : undefined,
      });
    } catch (error) {
      lastError = error;
      const classified = classifyAiError(error);
      lastReason = classified.reason;

      const next = chain[index + 1];
      if (next && classified.transient) {
        logAiFallback({
          label,
          fromProvider: provider.id,
          toProvider: next.id,
          reason: classified.reason,
          error,
        });
        continue;
      }

      if (!classified.transient) {
        throw error;
      }
    }
  }

  throw new AiExhaustedError(lastError, providersTried.length, providersTried);
}

export class AiOrchestrator {
  async complete(request: AiCompletionRequest): Promise<string> {
    const result = await this.completeWithMeta(request);
    return result.text;
  }

  async completeWithMeta(request: AiCompletionRequest): Promise<AiCompletionResult> {
    try {
      return await completeWithProviders(request);
    } catch (error) {
      if (!(error instanceof AiExhaustedError)) {
        throw error;
      }

      const queued = await Promise.race([
        enqueueAiRequest(request, (queuedRequest) => completeWithProviders(queuedRequest)),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new AiExhaustedError(
                error.cause ?? error,
                error.attempts + AI_ORCHESTRATOR_CONFIG.maxQueueRetries,
                error.providersTried,
              ),
            );
          }, AI_ORCHESTRATOR_CONFIG.queueMaxWaitMs);
        }),
      ]);

      return queued;
    }
  }
}

let orchestratorSingleton: AiOrchestrator | null = null;

export function getAiOrchestrator(): AiOrchestrator {
  if (!orchestratorSingleton) {
    orchestratorSingleton = new AiOrchestrator();
  }
  return orchestratorSingleton;
}

export async function askAi(prompt: string, label = "thea"): Promise<string> {
  return getAiOrchestrator().complete({ prompt, label });
}
