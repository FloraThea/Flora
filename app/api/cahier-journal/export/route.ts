import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { journalExporter } from "@/lib/journal/JournalExporter";
import { journalGenerator } from "@/lib/journal/JournalGenerator";
import { loadJournalPayload, saveJournalExport } from "@/lib/journal/journal-service";
import type { JournalExportFormat, JournalExportVariant } from "@/lib/journal/types";

const ROUTE_PATH = "/api/cahier-journal/export";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      journalId?: string;
      date?: string;
      format?: JournalExportFormat;
      variant?: JournalExportVariant;
      scope?: "day" | "week" | "period";
    };

    const format = body.format ?? "html";
    const variant = body.variant ?? "teacher";
    const scope = body.scope ?? "day";

    if (scope !== "day") {
      if (!body.date) {
        return jsonRouteError(ROUTE_PATH, 400, "date requise pour export semaine/période.");
      }

      const range =
        scope === "week"
          ? await journalGenerator.generateForWeek(body.date)
          : await journalGenerator.generateForPeriod(body.date);

      const payloads = (
        await Promise.all(
          range.days
            .filter((day) => day.journalId)
            .map((day) => loadJournalPayload(day.journalId!)),
        )
      ).filter(Boolean);

      const content = journalExporter.exportRange(
        payloads as NonNullable<Awaited<ReturnType<typeof loadJournalPayload>>>[],
        scope,
        variant,
      );

      return NextResponse.json({
        route: ROUTE_PATH,
        content,
        mimeType: "text/html",
        fileName: `cahier-journal-${scope}-${body.date}.html`,
        printAsPdf: format === "pdf",
      });
    }

    if (!body.journalId) {
      return jsonRouteError(ROUTE_PATH, 400, "journalId requis.");
    }

    const payload = await loadJournalPayload(body.journalId);
    if (!payload) {
      return jsonRouteError(ROUTE_PATH, 404, "Journal introuvable.");
    }

    const exported = journalExporter.export(payload, format, variant);

    await saveJournalExport({
      journalId: body.journalId,
      exportFormat: format,
      exportVariant: variant,
      content: exported.content,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      ...exported,
      printAsPdf: format === "pdf",
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Export du cahier journal impossible.",
      toErrorMessage(error),
    );
  }
}
