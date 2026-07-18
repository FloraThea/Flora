import { floraDb } from "@/lib/supabase/get-db";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import {
  applyCompetencyMatchesToRows,
  matchImportedCompetencies,
} from "@/lib/programming/import/competency-match";
import { loadProgrammation } from "@/lib/programming/programmation-service";
import { progressionValidator } from "../ProgressionValidator";
import { saveProgressionWithSync } from "../progression-service";
import type { ProgressionPayload } from "../types";
import { mapImportedRowsToStandaloneTabs, mapImportedRowsToTabs } from "./map-import-to-tabs";
import { parseProgressionFile } from "./parse-progression";
import {
  buildStandaloneProgressionContext,
  emptyCalendarSnapshot,
  sessionLinkMode,
} from "./standalone-context";
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
  programmationId?: string | null;
  methode?: string;
  title?: string;
  schoolYear?: string;
}): Promise<ProgressionImportSession> {
  const competencyMatches = await matchImportedCompetencies(input.parsed.rows);
  const correctedRows = applyCompetencyMatchesToRows(input.parsed.rows, competencyMatches);

  if (input.programmationId) {
    const programmation = await loadProgrammation(input.programmationId);

    if (!programmation) {
      throw new Error("Programmation introuvable.");
    }

    if (programmation.programmation.status !== "validated") {
      throw new Error("Seule une programmation validée peut recevoir une progression importée.");
    }

    const methode = input.methode || programmation.programmation.methode;
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

  const methode = input.methode ?? "";
  const tabs = mapImportedRowsToStandaloneTabs(correctedRows, input.parsed.discipline);

  return {
    parsed: input.parsed,
    tabs,
    programmationId: null,
    methode,
    title: input.title ?? `Import progression — ${input.parsed.discipline || "Flora"}`,
    competencyMatches: competencyMatches as unknown as Record<string, unknown>,
  };
}

export async function saveImportedProgression(input: {
  session: ProgressionImportSession;
  sourceFileName?: string;
  sourceStoragePath?: string;
  schoolYear?: string;
}): Promise<ProgressionPayload> {
  const context = input.session.programmationId
    ? await (async () => {
        const { progressionGenerator } = await import("../ProgressionGenerator");
        return progressionGenerator.buildContext({
          programmationId: input.session.programmationId!,
          methode: input.session.methode,
        });
      })()
    : buildStandaloneProgressionContext({
        methode: input.session.methode,
        schoolYear: input.schoolYear,
      });

  const validation = progressionValidator.validate(input.session.tabs, context);

  return saveProgressionWithSync({
    title: input.session.title,
    programmationId: input.session.programmationId,
    methode: input.session.methode,
    calendarSnapshot: context.calendar ?? emptyCalendarSnapshot(input.schoolYear),
    validation,
    tabs: input.session.tabs,
    linkMode: sessionLinkMode(input.session),
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

  const { error } = await (await floraDb()).storage.from(bucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible d'archiver le fichier source."));
  }

  const { data } = (await floraDb()).storage.from(bucket).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}
