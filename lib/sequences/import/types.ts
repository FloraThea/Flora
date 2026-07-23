import type { LessonDocumentParseResult } from "@/lib/pedagogical/import/lesson-document-parser";
import type { ImportLinkBundle } from "@/lib/pedagogical/import/link-suggestions";
import type { SequenceDraft, SequencePayload } from "../types";

export type ParsedSequenceImport = LessonDocumentParseResult & {
  importKind: "sequence";
};

export type SequenceImportSession = {
  parsed: ParsedSequenceImport;
  drafts: SequenceDraft[];
  linkSuggestions: ImportLinkBundle;
  selectedLinks: Array<{
    sequenceIndex: number;
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

export type SequenceImportSaveResult = {
  sequences: SequencePayload[];
};
