import { AI_ORCHESTRATOR_CONFIG } from "../config";
import type { AiProvider } from "../types";

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export class OpenAiProvider implements AiProvider {
  readonly id = "openai" as const;
  readonly model: string;

  constructor() {
    this.model = AI_ORCHESTRATOR_CONFIG.openaiModel;
  }

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  async complete(prompt: string, options?: { signal?: AbortSignal }): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY non configurée.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
      signal: options?.signal,
    });

    const payload = (await response.json()) as OpenAiResponse;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `OpenAI HTTP ${response.status}`);
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Réponse OpenAI vide.");
    }

    return text;
  }
}
