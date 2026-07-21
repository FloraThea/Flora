import { IMPORT_CONFIG } from "@/lib/documents/import/config";
import type { AiProviderId } from "./types";

function readInt(envKey: string, fallback: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readProviderList(envKey: string, fallback: AiProviderId[]): AiProviderId[] {
  const raw = process.env[envKey]?.trim();
  if (!raw || raw === "none") return [];

  const allowed = new Set<AiProviderId>(["gemini", "openai", "anthropic"]);
  const items = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is AiProviderId => allowed.has(entry as AiProviderId));

  return items.length > 0 ? items : fallback;
}

export const AI_ORCHESTRATOR_CONFIG = {
  get primaryProvider(): AiProviderId {
    return (process.env.FLORA_AI_PRIMARY?.trim().toLowerCase() ?? "gemini") as AiProviderId;
  },
  get fallbackProviders(): AiProviderId[] {
    return readProviderList("FLORA_AI_FALLBACK", ["openai"]);
  },
  providerTimeoutMs: readInt("FLORA_AI_PROVIDER_TIMEOUT_MS", 120_000),
  primaryMaxAttempts: IMPORT_CONFIG.gemini.retryAttempts,
  primaryRetryDelayMs: IMPORT_CONFIG.gemini.retryDelayMs,
  fallbackMaxAttempts: readInt("FLORA_AI_FALLBACK_RETRY_ATTEMPTS", 2),
  fallbackRetryDelayMs: readInt("FLORA_AI_FALLBACK_RETRY_DELAY_MS", 5_000),
  queueRetryMinutes: IMPORT_CONFIG.gemini.deferredRetryMinutes,
  maxQueueRetries: IMPORT_CONFIG.gemini.maxDeferredRetries,
  queuePollIntervalMs: readInt("FLORA_AI_QUEUE_POLL_MS", 5_000),
  queueMaxWaitMs: readInt("FLORA_AI_QUEUE_MAX_WAIT_MS", 600_000),
  geminiModel: process.env.FLORA_GEMINI_MODEL?.trim() || "gemini-2.5-flash",
  openaiModel: process.env.FLORA_OPENAI_MODEL?.trim() || "gpt-4o-mini",
  anthropicModel: process.env.FLORA_ANTHROPIC_MODEL?.trim() || "claude-3-5-haiku-latest",
} as const;
