import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  applyCompetencyMatchesToRows,
  matchImportedCompetencies,
} from "@/lib/programming/import/competency-match";
import { loadProgrammation } from "@/lib/programming/programmation-service";
import { progressionGenerator } from "../ProgressionGenerator";
import { progressionValidator } from "../ProgressionValidator";
import { saveProgressionWithSync } from "../progression-service";
import type { ProgressionPayload } from "../types";
import { mapImportedRowsToTabs } from "./map-import-to-tabs";
import { parseProgressionFile } from "./parse-progression";
import type { ParsedProgressionImport, ProgressionImportSession } from "./types";
import {
  buildProgressionStoragePath,
  getStorageBucketName,
} from "@/lib/supabase/storage-config";

export async function analyzeProgressionImport(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
}) {
  return parseProgressionFile(input);
}

export async function buildProgressionImportSession(input: {
  parsed: ParsedProgressionImport;
  programmationId: string;
  methode?: string;
  title?: string;
}): Promise<ProgressionImportSession> {
  const programmation = await loadProgrammation(input.programmationId);

  if (!programmation) {
    throw new Error("Programmation introuvable.");
  }

  if (programmation.programmation.status !== "validated") {
    throw new Error("Seule une programmation validée peut recevoir une progression importée.");
  }

  const methode = input.methode || programmation.programmation.methode;
  const competencyMatches = await matchImportedCompetencies(input.parsed.rows);
  const correctedRows = applyCompetencyMatchesToRows(input.parsed.rows, competencyMatches);
  const tabs = mapImportedRowsToTabs(correctedRows, programmation);

  return {
    parsed: input.parsed,
    tabs,
    programmationId: input.programmationId,
    methode,
    title:
      input.title ??
      `Import progression — ${programmation.programmation.title}`,
    competencyMatches: competencyMatches as unknown as Record<string, unknown>,
  };
}

export async function saveImportedProgression(input: {
  session: ProgressionImportSession;
  sourceFileName?: string;
  sourceStoragePath?: string;
}): Promise<ProgressionPayload> {
  const context = await progressionGenerator.buildContext({
    programmationId: input.session.programmationId,
    methode: input.session.methode,
  });

  const validation = progressionValidator.validate(input.session.tabs, context);

  return saveProgressionWithSync({
    title: input.session.title,
    programmationId: input.session.programmationId,
    methode: input.session.methode,
    calendarSnapshot: context.calendar,
    validation,
    tabs: input.session.tabs,
    importMeta: {
      sourceType: "imported",
      sourceFileName: input.sourceFileName ?? input.session.parsed.fileName,
      sourceStoragePath: input.sourceStoragePath ?? "",
      importFormat: input.session.parsed.format,
      originalImport: input.session.parsed as unknown as Record<string, unknown>,
      competencyMatches: input.session.competencyMatches,
    },
  });
}

export async function uploadProgressionImportFile(
  profileId: string,
  file: File,
): Promise<{ storagePath: string; publicUrl: string }> {
  const bucket = getStorageBucketName();
  const storagePath = buildProgressionStoragePath(profileId, file.name);

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible d'archiver le fichier source."));
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}
