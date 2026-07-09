import { askThea } from "@/lib/thea/services/gemini";
import type { ParsedResource, PedagogicalExtractionResult } from "./types";
import { buildExtractKnowledgePrompt, parseKnowledgeExtraction } from "./prompts/extractKnowledge";

/**
 * Extrait les entités pédagogiques traçables depuis le texte source.
 */
export class PedagogicalExtractor {
  async extract(
    text: string,
    parsedResource: ParsedResource,
  ): Promise<PedagogicalExtractionResult> {
    const prompt = buildExtractKnowledgePrompt(text, parsedResource);
    const raw = await askThea(prompt);
    return parseKnowledgeExtraction(raw);
  }
}

export const pedagogicalExtractor = new PedagogicalExtractor();
