import type {
  KnowledgeIndexDraft,
  PedagogicalExtractionResult,
} from "./types";
import type { TextChunkDraft } from "@/lib/documents/types";
import type { TheaResourceAnalysis } from "@/lib/thea/analyseResource";

function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pushTerm(
  entries: KnowledgeIndexDraft[],
  term: string,
  category: string,
  weight: number,
  extra?: Partial<KnowledgeIndexDraft>,
) {
  const normalizedTerm = normalizeTerm(term);
  if (!normalizedTerm || normalizedTerm.length < 2) return;

  entries.push({
    term: term.trim(),
    normalizedTerm,
    category,
    weight,
    ...extra,
  });
}

/**
 * Construit l'index pédagogique recherchable d'un document.
 */
export class KnowledgeIndexer {
  buildIndex(input: {
    chunks: TextChunkDraft[];
    extraction: PedagogicalExtractionResult;
    tags: string[];
    analysis?: TheaResourceAnalysis;
  }): KnowledgeIndexDraft[] {
    const entries: KnowledgeIndexDraft[] = [];

    input.tags.forEach((tag) => pushTerm(entries, tag, "tag", 1.2));

    input.extraction.entities.forEach((entity) => {
      pushTerm(entries, entity.label, entity.entityType, 1.5, {
        entityTempId: entity.tempId,
        chunkIndex: entity.chunkIndex,
      });

      tokenize(entity.content).forEach((token) =>
        pushTerm(entries, token, entity.entityType, 0.8, {
          entityTempId: entity.tempId,
        }),
      );
    });

    input.chunks.forEach((chunk) => {
      pushTerm(entries, chunk.title, chunk.section_type, 1, {
        chunkIndex: chunk.chunk_index,
      });
      tokenize(chunk.content).slice(0, 12).forEach((token) =>
        pushTerm(entries, token, "section", 0.6, {
          chunkIndex: chunk.chunk_index,
        }),
      );
    });

    if (input.analysis?.title) {
      pushTerm(entries, input.analysis.title, "document", 1.3);
    }

    return dedupeEntries(entries);
  }
}

function tokenize(value: string): string[] {
  return normalizeTerm(value)
    .split(" ")
    .filter((token) => token.length > 3);
}

function dedupeEntries(entries: KnowledgeIndexDraft[]): KnowledgeIndexDraft[] {
  const map = new Map<string, KnowledgeIndexDraft>();

  entries.forEach((entry) => {
    const key = `${entry.normalizedTerm}:${entry.category}:${entry.entityTempId ?? ""}:${entry.chunkIndex ?? ""}`;
    const existing = map.get(key);
    if (!existing || entry.weight > existing.weight) {
      map.set(key, entry);
    }
  });

  return [...map.values()];
}

export const knowledgeIndexer = new KnowledgeIndexer();
