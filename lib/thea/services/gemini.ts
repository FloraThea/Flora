import "server-only";

import { GoogleGenAI } from "@google/genai";
import { withGeminiRetry } from "./gemini-retry";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function askThea(prompt: string): Promise<string> {
  return withGeminiRetry(
    async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return response.text ?? "";
    },
    { label: "thea" },
  );
}
