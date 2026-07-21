import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { getOrCreateTeacherProfile } from "@/lib/profile/profile-service";
import { getServerAuthUserId } from "@/lib/supabase/auth-server";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import {
  analyzeTimetableFile,
  applyMappingOverrides,
  loadSubjectMappingOverrides,
  saveImportedTimetable,
  validateImportSessions,
} from "@/lib/timetable/import/timetable-import-service";
import { edtImportTrace } from "@/lib/timetable/import/edt-import-trace";
import type { StructureOverrides, TimetableImportSaveInput } from "@/lib/timetable/import/types";
import { ensureActiveSchedule } from "@/lib/timetable/timetable-service";

const ROUTE_PATH = "/api/emploi-du-temps/import";

export async function POST(request: Request) {
  try {
    edtImportTrace("EDT-04", { status: "route_enter" });
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const action = String(formData.get("action") ?? "analyze");
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return jsonRouteError(ROUTE_PATH, 400, "Aucun fichier reçu.");
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name;
      edtImportTrace("EDT-07", { fileName, fileSize: buffer.length, status: action });
      const structureOverridesRaw = formData.get("structureOverrides");
      let structureOverrides: StructureOverrides | undefined;
      if (structureOverridesRaw) {
        try {
          structureOverrides = JSON.parse(String(structureOverridesRaw)) as StructureOverrides;
        } catch {
          return jsonRouteError(ROUTE_PATH, 400, "Paramètres de structure invalides.");
        }
      }

      logRouteInfo(ROUTE_PATH, "Import Excel EDT", { action, fileName, structureOverrides });

      if (action === "analyze") {
        const userId = await getServerAuthUserId();
        edtImportTrace("EDT-05", { userId, status: "resolve_user" });
        const bundle = await getOrCreateTeacherProfile();
        edtImportTrace("EDT-06", { userId, profileId: bundle.profile.id, status: "profile_ready" });
        const overrides = await loadSubjectMappingOverrides(bundle.profile.id);
        edtImportTrace("EDT-08", { profileId: bundle.profile.id, status: "analyzing" });
        const parsed = await analyzeTimetableFile(buffer, fileName, overrides, structureOverrides);
        const slotCount = parsed.sessions.filter((session) => !session.isEmpty).length;
        edtImportTrace("EDT-09", { profileId: bundle.profile.id, status: "completed", slotCount });
        edtImportTrace("EDT-10", { profileId: bundle.profile.id, status: "parsed", slotCount });
        edtImportTrace("EDT-13", { profileId: bundle.profile.id, status: "response_ok", slotCount });

        return NextResponse.json({
          route: ROUTE_PATH,
          importStatus: "completed",
          parsed,
          profileId: bundle.profile.id,
          userId,
          slotCount,
        });
      }

      return jsonRouteError(ROUTE_PATH, 400, "Action inconnue.");
    }

    const body = (await request.json()) as {
      action?: string;
      sessions?: TimetableImportSaveInput["sessions"];
      confirmedMappings?: Record<string, string>;
      scheduleId?: string;
      scheduleName?: string;
      variantType?: string;
      isPrimary?: boolean;
      schoolYear?: string;
      className?: string;
      teacherName?: string;
      sourceFileName?: string;
      structureOverrides?: StructureOverrides;
      parsed?: { sessions: TimetableImportSaveInput["sessions"] };
    };

    if (body.action === "analyze" && body.sourceFileName) {
      return jsonRouteError(
        ROUTE_PATH,
        400,
        "Pour ré-analyser, envoyez le fichier en multipart/form-data.",
      );
    }

    if (body.action === "remap" && body.parsed) {
      const remapped = applyMappingOverrides(
        {
          fileName: body.sourceFileName ?? "",
          sheetName: "",
          className: body.className ?? "",
          teacherName: body.teacherName ?? "",
          schoolYear: body.schoolYear ?? "",
          days: [],
          timeSlots: [],
          sessions: body.sessions ?? body.parsed.sessions,
          emptySlots: [],
          uncertainMappings: [],
          warnings: [],
          structure: {
            layout: "days_in_row",
            headerRow: 0,
            timeColumn: 0,
            dayColumn: -1,
            dayColumns: {},
            timeRows: {},
            confidence: 0,
          },
          needsManualStructure: false,
          diagnostics: {
            detectedDayRow: null,
            detectedDayColumn: null,
            detectedTimeColumn: null,
            detectedTimeRow: null,
            layout: "days_in_row",
            mergedCellCount: 0,
            detectedSubjects: [],
            anomalies: [],
            dayRowCandidates: [],
            timeColumnCandidates: [],
            decorativeRows: [],
          },
          gridPreview: [],
        },
        body.confirmedMappings ?? {},
      );
      return NextResponse.json({ route: ROUTE_PATH, parsed: remapped });
    }

    if (body.action === "validate" && body.sessions) {
      const bundle = await getOrCreateTeacherProfile();
      const { loadActiveScheduleForProfile } = await import("@/lib/timetable/timetable-service");
      const base =
        (await loadActiveScheduleForProfile(bundle.profile.id)) ??
        (await ensureActiveSchedule());
      const validation = validateImportSessions(body.sessions, base);
      return NextResponse.json({ route: ROUTE_PATH, validation });
    }

    if (body.action === "save" && body.sessions?.length) {
      edtImportTrace("EDT-08", { status: "saving", slotCount: body.sessions.length });
      const result = await saveImportedTimetable({
        scheduleId: body.scheduleId,
        scheduleName: body.scheduleName ?? "Emploi du temps importé",
        variantType: body.variantType,
        isPrimary: body.isPrimary ?? true,
        schoolYear: body.schoolYear,
        className: body.className,
        teacherName: body.teacherName,
        sessions: body.sessions,
        confirmedMappings: body.confirmedMappings,
        sourceFileName: body.sourceFileName,
      });

      edtImportTrace("EDT-13", {
        profileId: result.schedule.teacherProfileId,
        scheduleId: result.schedule.id,
        status: "save_completed",
        slotCount: result.slots.length,
      });

      let journalSynced = false;
      try {
        const { handleTimetableModified } = await import("@/lib/pedagogical/sync-handlers");
        await handleTimetableModified({ journal: true, agenda: true });
        journalSynced = true;
      } catch (syncError) {
        console.warn("[EDT] Sync cahier journal échouée après import :", syncError);
        try {
          await pedagogicalEngine.emit({ type: "emploi_du_temps.modifie", scope: "generate" });
          journalSynced = true;
        } catch {
          journalSynced = false;
        }
      }

      return NextResponse.json({
        route: ROUTE_PATH,
        importStatus: "completed",
        ...result,
        journalSynced,
        message: journalSynced
          ? "Emploi du temps validé et synchronisé avec le cahier journal."
          : "Emploi du temps validé. La synchronisation du cahier journal n'a pas pu être confirmée — actualisez depuis le cahier journal.",
      });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Requête invalide.");
  } catch (error) {
    const message = toErrorMessage(error);
    edtImportTrace("EDT-13", { status: "failed", error: message });
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Import emploi du temps impossible.",
      message,
    );
  }
}
