import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  exportSessionsToCsv,
  exportSessionsToWorkbook,
  sessionsToPrintHtml,
} from "@/lib/timetable/import/export-timetable";
import type { TimetableImportSession } from "@/lib/timetable/import/types";
import { loadActiveSchedule } from "@/lib/timetable/timetable-service";

const ROUTE_PATH = "/api/emploi-du-temps/export";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      format?: "xlsx" | "csv" | "html";
      sessions?: TimetableImportSession[];
      scheduleName?: string;
      className?: string;
      teacherName?: string;
    };

    let sessions = body.sessions;

    if (!sessions?.length) {
      const active = await loadActiveSchedule();
      if (!active) {
        return jsonRouteError(ROUTE_PATH, 404, "Aucun emploi du temps à exporter.");
      }
      sessions = active.slots.map((slot) => ({
        day: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        subject: slot.subject,
        title: slot.subSubject,
        level: String(slot.metadata.level ?? ""),
        group: String(slot.metadata.group ?? ""),
        location: slot.room,
        notes: String(slot.metadata.notes ?? ""),
        color: slot.color || String(slot.metadata.color ?? "#faf7f2"),
        subSubject: slot.subSubject,
        customText: slot.customText,
        slotType: slot.slotType,
        rawLabel: slot.label || slot.subject,
        isEmpty: false,
        rowIndex: 0,
        colIndex: 0,
      }));
    }

    const meta = {
      scheduleName: body.scheduleName ?? "Emploi du temps Flora",
      className: body.className,
      teacherName: body.teacherName,
    };

    const format = body.format ?? "xlsx";

    if (format === "csv") {
      const csv = exportSessionsToCsv(sessions);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="emploi-du-temps.csv"`,
        },
      });
    }

    if (format === "html") {
      const html = sessionsToPrintHtml(sessions, meta);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="emploi-du-temps.html"`,
        },
      });
    }

    const xlsx = exportSessionsToWorkbook(sessions, meta);
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="emploi-du-temps.xlsx"`,
      },
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Export impossible.", toErrorMessage(error));
  }
}
