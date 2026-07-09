import { askThea } from "./services/gemini";
import { buildAnalyseDocumentPrompt } from "./prompts/analyseDocument";

export async function analyseDocumentWithThea(text: string) {
  const prompt = buildAnalyseDocumentPrompt(text);
  const raw = await askThea(prompt);

  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}

export { analyseResourceWithThea } from "./analyseResource";
