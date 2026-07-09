import { askThea } from "./services/gemini";
import {
  buildAnalyseResourcePrompt,
  parseTheaResourceAnalysis,
  type TheaResourceAnalysis,
} from "./prompts/analyseResource";

export async function analyseResourceWithThea(
  text: string,
): Promise<TheaResourceAnalysis> {
  const prompt = buildAnalyseResourcePrompt(text);
  const raw = await askThea(prompt);
  return parseTheaResourceAnalysis(raw);
}

export type {
  TheaResourceAnalysis,
  TheaResourceCompetence,
  TheaResourceSection,
} from "./prompts/analyseResource";
