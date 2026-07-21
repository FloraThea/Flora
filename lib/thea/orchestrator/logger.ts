import type { AiCompletionMeta, AiFallbackReason, AiProviderId } from "./types";

export function logAiAttempt(input: {
  label: string;
  providerId: AiProviderId;
  model: string;
  attempt: number;
  maxAttempts: number;
  fallbackFrom?: AiProviderId;
  fallbackReason?: AiFallbackReason;
}) {
  console.info("[ai-orchestrator] Tentative", {
    label: input.label,
    provider: input.providerId,
    model: input.model,
    attempt: `${input.attempt}/${input.maxAttempts}`,
    fallbackFrom: input.fallbackFrom ?? null,
    fallbackReason: input.fallbackReason ?? null,
  });
}

export function logAiSuccess(meta: AiCompletionMeta & { label: string }) {
  console.info("[ai-orchestrator] Succès", {
    label: meta.label,
    provider: meta.providerId,
    model: meta.model,
    durationMs: meta.durationMs,
    attempt: meta.attempt,
    fallbackFrom: meta.fallbackFrom ?? null,
    fallbackReason: meta.fallbackReason ?? null,
    queued: meta.queued ?? false,
  });
}

export function logAiFallback(input: {
  label: string;
  fromProvider: AiProviderId;
  toProvider: AiProviderId;
  reason: AiFallbackReason;
  error: unknown;
}) {
  console.warn("[ai-orchestrator] Basculement", {
    label: input.label,
    fromProvider: input.fromProvider,
    toProvider: input.toProvider,
    reason: input.reason,
    error: input.error instanceof Error ? input.error.message : String(input.error),
  });
}

export function logAiQueue(input: {
  label: string;
  action: "enqueued" | "retry" | "success" | "exhausted";
  attempt?: number;
  maxAttempts?: number;
  retryAfterMs?: number;
}) {
  console.info("[ai-orchestrator] File d'attente", input);
}
