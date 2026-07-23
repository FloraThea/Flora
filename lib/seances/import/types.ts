import type { LessonDocumentParseResult } from "@/lib/pedagogical/import/lesson-document-parser";
import type { ImportLinkBundle } from "@/lib/pedagogical/import/link-suggestions";
import type { SeanceDraft, SeancePayload } from "../types";

export type ParsedSeanceImport = LessonDocumentParseResult & {
  importKind: "seance";
};

export type SeanceImportSession = {
  parsed: ParsedSeanceImport;
  drafts: SeanceDraft[];
  linkSuggestions: ImportLinkBundle;
  selectedLinks: Array<{
    seanceIndex: number;
    sequenceId?: string | null;
    sequenceSessionId?: string | null;
    progressionRowId?: string | null;
    progressionId?: string | null;
    programmationId?: string | null;
  }>;
  title: string;
  competencyMatches: Record<string, unknown>;
  summary: {
    sequenceCount: number;
    sessionCount: number;
    competences: string[];
    objectifs: string[];
    missingSessions: string[];
    uncertainFields: string[];
    confidence: number;
  };
};

export type SeanceImportSaveResult = {
  seances: SeancePayload[];
};
