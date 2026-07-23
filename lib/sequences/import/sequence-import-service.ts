import type { LessonDocumentParseResult } from "@/lib/pedagogical/import/lesson-document-parser";
import {
  buildImportSummary,
  parseLessonDocument,
} from "@/lib/pedagogical/import/lesson-document-parser";
import { suggestImportLinks } from "@/lib/pedagogical/import/link-suggestions";
import {
  applyCompetencyMatchesToRows,
  matchImportedCompetencies,
} from "@/lib/programming/import/competency-match";
import type { ImportedProgrammationRow } from "@/lib/programming/import/types";
import { floraDb } from "@/lib/supabase/get-db";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  buildSequenceStoragePath,
  getStorageBucketName,
} from "@/lib/supabase/storage-config";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { insertSequenceRecordForImport } from "../sequence-service";
import { mapParsedImportToSequenceDrafts } from "./map-import-to-sequence";
import type {
  ParsedSequenceImport,
  SequenceImportSaveResult,
  SequenceImportSession,
} from "./types";

function competencyRowsFromParsed(parsed: LessonDocumentParseResult): ImportedProgrammationRow[] {
  return parsed.sequences.flatMap((sequence, sequenceIndex) =>
    sequence.sessions.map((session, sessionIndex) => ({
      id: `seq-${sequenceIndex}-${sessionIndex}`,
      periodNumber: sequence.periodNumber.value,
      weekNumber: sequence.weekNumbers.value[0] ?? null,
      weekLabel: "",
      calendarDate: session.date.value,
      dayOfWeek: null,
      discipline: sequence.matiere.value,
      niveau: sequence.niveau.value,
      sequence: sequence.title.value,
      seance: session.title.value,
      objectif: session.objectif.value,
      competences: sequence.competences.value,
      notions: [],
      materiel: session.materiel.value,
      ressources: session.ressources.value,
      remarques: "",
      deroulement: session.deroulement.value,
      evaluation: session.evaluation.value,
      differenciation: session.differentiation.value,
      domaine: "",
      rawLine: session.rawLine ?? "",
      rawCells: [],
      parseConfidence: session.parseConfidence,
    })),
  );
}

export async function analyzeSequenceImport(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
}): Promise<ParsedSequenceImport> {
  const parsed = await parseLessonDocument({ ...input, mode: "sequence" });
  return { ...parsed, importKind: "sequence" };
}

export async function buildSequenceImportSession(input: {
  parsed: ParsedSequenceImport;
  title?: string;
  matiere?: string;
  sousMatiere?: string;
  niveau?: string;
  methode?: string;
}): Promise<SequenceImportSession> {
  const drafts = mapParsedImportToSequenceDrafts(input.parsed.sequences, {
    matiere: input.matiere,
    sousMatiere: input.sousMatiere,
    niveau: input.niveau,
    methode: input.methode,
  });

  const primary = input.parsed.sequences[0];
  const linkSuggestions = await suggestImportLinks({
    matiere: input.matiere ?? primary?.matiere.value,
    sousMatiere: input.sousMatiere ?? primary?.sousMatiere.value,
    niveau: input.niveau ?? primary?.niveau.value,
    periodNumber: primary?.periodNumber.value,
    weekNumbers: primary?.weekNumbers.value,
    competence: primary?.competences.value[0],
    objectif: primary?.objectifs.value[0],
  });

  const competencyMatches = await matchImportedCompetencies(competencyRowsFromParsed(input.parsed));
  applyCompetencyMatchesToRows(competencyRowsFromParsed(input.parsed), competencyMatches);

  return {
    parsed: input.parsed,
    drafts,
    linkSuggestions,
    selectedLinks: drafts.map((_, index) => ({ sequenceIndex: index })),
    title: input.title ?? drafts[0]?.title ?? "Import séquences",
    competencyMatches: competencyMatches as unknown as Record<string, unknown>,
    summary: buildImportSummary(input.parsed),
  };
}

export async function saveImportedSequences(input: {
  session: SequenceImportSession;
  sourceFileName?: string;
  sourceStoragePath?: string;
}): Promise<SequenceImportSaveResult> {
  const saved: SequenceImportSaveResult["sequences"] = [];

  for (let index = 0; index < input.session.drafts.length; index += 1) {
    const draft = input.session.drafts[index]!;
    const selected = input.session.selectedLinks.find((link) => link.sequenceIndex === index);

    let progressionId = selected?.progressionId ?? null;
    let programmationId = selected?.programmationId ?? null;
    const progressionRowId = selected?.progressionRowId ?? null;

    if (progressionRowId && !progressionId) {
      const { data: row } = await (await floraDb())
        .from("progression_rows")
        .select("progression_tab_id, progression_tabs(progression_id, programmation_id)")
        .eq("id", progressionRowId)
        .maybeSingle();
      const tab = row?.progression_tabs as
        | { progression_id?: string; programmation_id?: string | null }
        | undefined;
      progressionId = tab?.progression_id ?? null;
      programmationId = tab?.programmation_id ?? null;
    }

    const payload = await insertSequenceRecordForImport({
      draft,
      progressionId,
      progressionRowId,
      programmationId,
      linkMode: progressionRowId && progressionId ? "linked" : "independent",
      importMeta: {
        source_type: "imported",
        source_file_name: input.sourceFileName ?? input.session.parsed.fileName,
        source_storage_path: input.sourceStoragePath ?? "",
        import_confidence: input.session.summary.confidence,
        original_import: input.session.parsed,
        competency_matches: input.session.competencyMatches,
      },
    });

    saved.push(payload);
  }

  return { sequences: saved };
}

export async function uploadSequenceImportFile(
  profileId: string,
  file: File,
): Promise<{ storagePath: string; publicUrl: string }> {
  const bucket = getStorageBucketName();
  const storagePath = buildSequenceStoragePath(profileId, file.name);

  const { error } = await (await floraDb()).storage.from(bucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible d'archiver le fichier source."));
  }

  const { data } = (await floraDb()).storage.from(bucket).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}

export async function requireSequenceImportProfileId(): Promise<string> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) throw new Error("Profil enseignant requis.");
  return bundle.profile.id;
}
