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
import { buildSeanceStoragePath, getStorageBucketName } from "@/lib/supabase/storage-config";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { insertSeanceRecordForImport } from "../seance-service";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { mapParsedImportToSeanceDrafts } from "./map-import-to-seance";
import type {
  ParsedSeanceImport,
  SeanceImportSaveResult,
  SeanceImportSession,
} from "./types";

function sessionsFromParsed(parsed: ParsedSeanceImport) {
  return [
    ...parsed.standaloneSessions,
    ...parsed.sequences.flatMap((sequence) => sequence.sessions),
  ];
}

function competencyRowsFromParsed(parsed: ParsedSeanceImport): ImportedProgrammationRow[] {
  return sessionsFromParsed(parsed).map((session, index) => ({
    id: `sea-${index}`,
    periodNumber: null,
    weekNumber: session.sessionNumber,
    weekLabel: "",
    calendarDate: session.date.value,
    dayOfWeek: null,
    discipline: "",
    niveau: "",
    sequence: "",
    seance: session.title.value,
    objectif: session.objectif.value,
    competences: session.competence.value ? [session.competence.value] : [],
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
  }));
}

export async function analyzeSeanceImport(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
}): Promise<ParsedSeanceImport> {
  const parsed = await parseLessonDocument({ ...input, mode: "seance" });
  return { ...parsed, importKind: "seance" };
}

export async function buildSeanceImportSession(input: {
  parsed: ParsedSeanceImport;
  title?: string;
  matiere?: string;
  sousMatiere?: string;
  niveau?: string;
  methode?: string;
  periodNumber?: number;
  weekNumber?: number;
}): Promise<SeanceImportSession> {
  const sessions = sessionsFromParsed(input.parsed);
  const drafts = mapParsedImportToSeanceDrafts(sessions, {
    matiere: input.matiere,
    sousMatiere: input.sousMatiere,
    niveau: input.niveau,
    methode: input.methode,
    periodNumber: input.periodNumber,
    weekNumber: input.weekNumber,
  });

  const primary = sessions[0];
  const linkSuggestions = await suggestImportLinks({
    matiere: input.matiere,
    sousMatiere: input.sousMatiere,
    niveau: input.niveau,
    weekNumbers: input.weekNumber ? [input.weekNumber] : undefined,
    periodNumber: input.periodNumber,
    competence: primary?.competence.value,
    objectif: primary?.objectif.value,
  });

  const competencyMatches = await matchImportedCompetencies(competencyRowsFromParsed(input.parsed));
  applyCompetencyMatchesToRows(competencyRowsFromParsed(input.parsed), competencyMatches);

  return {
    parsed: input.parsed,
    drafts,
    linkSuggestions,
    selectedLinks: drafts.map((_, index) => ({ seanceIndex: index })),
    title: input.title ?? drafts[0]?.title ?? "Import séances",
    competencyMatches: competencyMatches as unknown as Record<string, unknown>,
    summary: buildImportSummary(input.parsed),
  };
}

export async function saveImportedSeances(input: {
  session: SeanceImportSession;
  sourceFileName?: string;
  sourceStoragePath?: string;
}): Promise<SeanceImportSaveResult> {
  const scope = await requireTeacherScope();
  const saved: SeanceImportSaveResult["seances"] = [];

  for (let index = 0; index < input.session.drafts.length; index += 1) {
    const draft = input.session.drafts[index]!;
    const selected = input.session.selectedLinks.find((link) => link.seanceIndex === index);

    const payload = await insertSeanceRecordForImport({
      draft,
      sequenceSessionId: selected?.sequenceSessionId ?? null,
      sequenceId: selected?.sequenceId ?? null,
      progressionId: selected?.progressionId ?? null,
      progressionRowId: selected?.progressionRowId ?? null,
      programmationId: selected?.programmationId ?? null,
      teacherProfileId: scope.profileId,
      linkMode:
        selected?.sequenceSessionId && selected?.sequenceId ? "linked" : "independent",
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

  return { seances: saved };
}

export async function uploadSeanceImportFile(
  profileId: string,
  file: File,
): Promise<{ storagePath: string; publicUrl: string }> {
  const bucket = getStorageBucketName();
  const storagePath = buildSeanceStoragePath(profileId, file.name);

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

export async function requireSeanceImportProfileId(): Promise<string> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) throw new Error("Profil enseignant requis.");
  return bundle.profile.id;
}
