import { AI_ORCHESTRATOR_CONFIG } from "./config";
import { AiExhaustedError, classifyAiError } from "./errors";
import { logAiQueue } from "./logger";
import type { AiCompletionRequest, AiCompletionResult } from "./types";

type QueueItem = {
  id: string;
  request: AiCompletionRequest;
  attempt: number;
  retryAfter: number;
  resolve: (value: AiCompletionResult) => void;
  reject: (error: Error) => void;
};

type CompleteFn = (request: AiCompletionRequest) => Promise<AiCompletionResult>;

let queueCounter = 0;
let processorTimer: ReturnType<typeof setInterval> | null = null;
const pendingQueue: QueueItem[] = [];

function ensureProcessor(processor: () => Promise<void>) {
  if (processorTimer) return;

  processorTimer = setInterval(() => {
    void processor();
  }, AI_ORCHESTRATOR_CONFIG.queuePollIntervalMs);
}

export function enqueueAiRequest(
  request: AiCompletionRequest,
  completeFn: CompleteFn,
): Promise<AiCompletionResult> {
  return new Promise((resolve, reject) => {
    const item: QueueItem = {
      id: `ai-queue-${++queueCounter}`,
      request,
      attempt: 0,
      retryAfter: Date.now(),
      resolve,
      reject,
    };

    pendingQueue.push(item);

    logAiQueue({
      label: request.label ?? "thea",
      action: "enqueued",
      attempt: 0,
      maxAttempts: AI_ORCHESTRATOR_CONFIG.maxQueueRetries,
      retryAfterMs: AI_ORCHESTRATOR_CONFIG.queueRetryMinutes * 60_000,
    });

    ensureProcessor(() => processAiQueue(completeFn));
  });
}

async function processAiQueue(completeFn: CompleteFn): Promise<void> {
  const now = Date.now();

  for (const item of [...pendingQueue]) {
    if (item.retryAfter > now) continue;

    logAiQueue({
      label: item.request.label ?? "thea",
      action: "retry",
      attempt: item.attempt + 1,
      maxAttempts: AI_ORCHESTRATOR_CONFIG.maxQueueRetries,
    });

    try {
      const result = await completeFn({
        ...item.request,
        label: item.request.label ?? "thea-queue",
      });

      removeQueueItem(item.id);
      logAiQueue({
        label: item.request.label ?? "thea",
        action: "success",
        attempt: item.attempt + 1,
      });
      item.resolve({ ...result, meta: { ...result.meta, queued: true } });
    } catch (error) {
      if (!(error instanceof AiExhaustedError) && !classifyAiError(error).transient) {
        removeQueueItem(item.id);
        item.reject(error instanceof Error ? error : new Error(String(error)));
        continue;
      }

      item.attempt += 1;

      if (item.attempt >= AI_ORCHESTRATOR_CONFIG.maxQueueRetries) {
        removeQueueItem(item.id);
        logAiQueue({
          label: item.request.label ?? "thea",
          action: "exhausted",
          attempt: item.attempt,
          maxAttempts: AI_ORCHESTRATOR_CONFIG.maxQueueRetries,
        });
        item.reject(
          error instanceof AiExhaustedError
            ? error
            : new AiExhaustedError(error, item.attempt),
        );
        continue;
      }

      item.retryAfter = now + AI_ORCHESTRATOR_CONFIG.queueRetryMinutes * 60_000;
    }
  }

  if (pendingQueue.length === 0 && processorTimer) {
    clearInterval(processorTimer);
    processorTimer = null;
  }
}

function removeQueueItem(id: string) {
  const index = pendingQueue.findIndex((item) => item.id === id);
  if (index >= 0) pendingQueue.splice(index, 1);
}

export function getPendingAiQueueSize(): number {
  return pendingQueue.length;
}

/** Utilisé par les tests pour réinitialiser l'état. */
export function resetAiQueueForTests(): void {
  pendingQueue.splice(0, pendingQueue.length);
  if (processorTimer) {
    clearInterval(processorTimer);
    processorTimer = null;
  }
}
