import { GoogleGenAI } from "@google/genai";
import { AI_ORCHESTRATOR_CONFIG } from "../config";
import type { AiProvider } from "../types";

export class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  readonly model: string;
  private readonly client: GoogleGenAI | null;

  constructor() {
    this.model = AI_ORCHESTRATOR_CONFIG.geminiModel;
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(prompt: string, options?: { signal?: AbortSignal }): Promise<string> {
    if (!this.client) {
      throw new Error("GEMINI_API_KEY non configurée.");
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: options?.signal ? { abortSignal: options.signal } : undefined,
    });

    return response.text ?? "";
  }
}
