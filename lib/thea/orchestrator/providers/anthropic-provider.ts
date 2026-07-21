import { AI_ORCHESTRATOR_CONFIG } from "../config";
import type { AiProvider } from "../types";

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
};

export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  readonly model: string;

  constructor() {
    this.model = AI_ORCHESTRATOR_CONFIG.anthropicModel;
  }

  isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  }

  async complete(prompt: string, options?: { signal?: AbortSignal }): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY non configurée.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: options?.signal,
    });

    const payload = (await response.json()) as AnthropicResponse;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Anthropic HTTP ${response.status}`);
    }

    const text = payload.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new Error("Réponse Anthropic vide.");
    }

    return text;
  }
}
