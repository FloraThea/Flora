import { AI_ORCHESTRATOR_CONFIG } from "../config";
import type { AiProvider, AiProviderId } from "../types";
import { AnthropicProvider } from "./anthropic-provider";
import { GeminiProvider } from "./gemini-provider";
import { OpenAiProvider } from "./openai-provider";
import { OpenRouterProvider } from "./openrouter-provider";

const providerConstructors: Record<AiProviderId, () => AiProvider> = {
  gemini: () => new GeminiProvider(),
  openrouter: () => new OpenRouterProvider(),
  openai: () => new OpenAiProvider(),
  anthropic: () => new AnthropicProvider(),
};

let cachedProviders: Map<AiProviderId, AiProvider> | null = null;

function getProviderRegistry(): Map<AiProviderId, AiProvider> {
  if (!cachedProviders) {
    cachedProviders = new Map(
      (Object.keys(providerConstructors) as AiProviderId[]).map((id) => [id, providerConstructors[id]()]),
    );
  }
  return cachedProviders;
}

export function getAiProvider(id: AiProviderId): AiProvider {
  const provider = getProviderRegistry().get(id);
  if (!provider) {
    throw new Error(`Fournisseur IA inconnu : ${id}`);
  }
  return provider;
}

export function resolveProviderChain(): AiProvider[] {
  const registry = getProviderRegistry();
  const chain: AiProvider[] = [];

  const primary = registry.get(AI_ORCHESTRATOR_CONFIG.primaryProvider);
  if (primary?.isConfigured()) {
    chain.push(primary);
  }

  for (const fallbackId of AI_ORCHESTRATOR_CONFIG.fallbackProviders) {
    if (fallbackId === AI_ORCHESTRATOR_CONFIG.primaryProvider) continue;
    const fallback = registry.get(fallbackId);
    if (fallback?.isConfigured()) {
      chain.push(fallback);
    }
  }

  return chain;
}

export function isAnyAiProviderConfigured(): boolean {
  return resolveProviderChain().length > 0;
}

/** Enregistre un fournisseur custom (tests ou extension future). */
export function registerAiProvider(provider: AiProvider): void {
  getProviderRegistry().set(provider.id, provider);
}

export function resetAiProviderRegistry(): void {
  cachedProviders = null;
}
