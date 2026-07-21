import { AI_ORCHESTRATOR_CONFIG } from "../config";
import type { AiProvider } from "../types";

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export class OpenRouterProvider implements AiProvider {
  readonly id = "openrouter" as const;
  readonly model: string;

  constructor() {
    this.model = AI_ORCHESTRATOR_CONFIG.openrouterModel;
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  }

  async complete(prompt: string, options?: { signal?: AbortSignal }): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY non configurée.");
    }

    const referer =
      process.env.FLORA_OPENROUTER_HTTP_REFERER?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "https://flora.app";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "Flora",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: options?.signal,
    });

    const payload = (await response.json()) as OpenRouterResponse;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `OpenRouter HTTP ${response.status}`);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Réponse OpenRouter vide.");
    }

    return text;
  }
}
