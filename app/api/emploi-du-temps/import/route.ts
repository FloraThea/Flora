import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import {
  analyzeTimetableFile,
  applyMappingOverrides,
  loadSubjectMappingOverrides,
  saveImportedTimetable,
  validateImportSessions,
} from "@/lib/timetable/import/timetable-import-service";
import type { StructureOverrides, TimetableImportSaveInput } from "@/lib/timetable/import/types";
import { ensureActiveSchedule } from "@/lib/timetable/timetable-service";

const ROUTE_PATH = "/api/emploi-du-temps/import";

export async function POST(request: Request) {
  try {
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

      const base = await ensureActiveSchedule();
      const overrides = await loadSubjectMappingOverrides(base.schedule.teacherProfileId);

      if (action === "analyze") {
        const parsed = await analyzeTimetableFile(buffer, fileName, overrides, structureOverrides);
        return NextResponse.json({ route: ROUTE_PATH, parsed });
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
      const base = await ensureActiveSchedule();
      const validation = validateImportSessions(body.sessions, base);
      return NextResponse.json({ route: ROUTE_PATH, validation });
    }

    if (body.action === "save" && body.sessions?.length) {
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

      await pedagogicalEngine.emit({ type: "emploi_du_temps.modifie", scope: "generate" });
      return NextResponse.json({
        route: ROUTE_PATH,
        ...result,
        journalSynced: true,
        message: "Emploi du temps validé et synchronisé avec le cahier journal.",
      });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Requête invalide.");
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Import emploi du temps impossible.",
      toErrorMessage(error),
    );
  }
}
