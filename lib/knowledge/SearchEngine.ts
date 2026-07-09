import { supabase } from "@/lib/supabase";
import type { IntelligentSearchResult } from "./types";

function normalizeTerm(term: string): string {
  return term
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type IndexRow = {
  document_id: string;
  term: string;
  normalized_term: string;
  category: string;
  weight: number;
};

/**
 * Moteur de recherche intelligent basé sur l'index pédagogique.
 */
export class SearchEngine {
  async search(query: string, limit = 20): Promise<IntelligentSearchResult[]> {
    const normalizedQuery = normalizeTerm(query);
    if (!normalizedQuery) return [];

    const tokens = normalizedQuery.split(" ").filter(Boolean);

    const { data, error } = await supabase.from("knowledge_index").select(
      "document_id, term, normalized_term, category, weight",
    );

    if (error) {
      console.error("Erreur SearchEngine :", error);
      return [];
    }

    const scores = new Map<
      string,
      IntelligentSearchResult & { matchedTermsSet: Set<string> }
    >();

    for (const row of (data ?? []) as IndexRow[]) {
      let score = 0;
      const matchedTerms: string[] = [];

      for (const token of tokens) {
        if (row.normalized_term.includes(token)) {
          score += row.weight;
          matchedTerms.push(row.term);
        }
      }

      if (score <= 0) continue;

      const existing = scores.get(row.document_id);

      if (!existing) {
        scores.set(row.document_id, {
          documentId: row.document_id,
          title: "",
          score,
          matchedTerms,
          snippet: row.term,
          matchedTermsSet: new Set(matchedTerms),
        });
        continue;
      }

      existing.score += score;
      matchedTerms.forEach((term) => existing.matchedTermsSet.add(term));
      existing.matchedTerms = [...existing.matchedTermsSet];
    }

    const documentIds = [...scores.keys()];
    if (documentIds.length === 0) return [];

    const { data: documents } = await supabase
      .from("documents")
      .select("id, title, original_filename, resume, metadata")
      .in("id", documentIds);

    for (const document of documents ?? []) {
      if (document.metadata?.archived) {
        scores.delete(document.id);
        continue;
      }

      const result = scores.get(document.id);
      if (!result) continue;

      result.title = document.title || document.original_filename || "Document";
      if (document.resume) result.snippet = document.resume;
    }

    return [...scores.values()]
      .filter((result) => result.title)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((result) => ({
        documentId: result.documentId,
        title: result.title,
        score: result.score,
        matchedTerms: result.matchedTerms,
        snippet: result.snippet,
      }));
  }
}

export const searchEngine = new SearchEngine();
