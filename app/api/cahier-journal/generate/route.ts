import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { findJournalByDate, loadJournalPayload } from "@/lib/journal/journal-service";
import { journalGenerator } from "@/lib/journal/JournalGenerator";

const ROUTE_PATH = "/api/cahier-journal/generate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      regenerate?: boolean;
      proposeAdjustments?: boolean;
      range?: "week" | "period";
    };

    if (body.range === "week" && body.date) {
      const range = await journalGenerator.generateForWeek(body.date);
      return NextResponse.json({ route: ROUTE_PATH, ...range });
    }

    if (body.range === "period" && body.date) {
      const range = await journalGenerator.generateForPeriod(body.date);
      return NextResponse.json({ route: ROUTE_PATH, ...range });
    }

    if (!body.date) {
      return jsonRouteError(ROUTE_PATH, 400, "date requise (YYYY-MM-DD).");
    }

    logRouteInfo(ROUTE_PATH, "Génération cahier journal", {
      date: body.date,
      regenerate: body.regenerate ?? false,
    });

    const payload = await journalGenerator.generateForDate({
      date: body.date,
      regenerate: body.regenerate,
      proposeAdjustments: body.proposeAdjustments,
    });

    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de générer le cahier journal.",
      toErrorMessage(error),
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const id = searchParams.get("id");
    const range = searchParams.get("range");

    if (range === "week" && date) {
      const weekPayload = await journalGenerator.generateForWeek(date);
      return NextResponse.json({ route: ROUTE_PATH, ...weekPayload });
    }

    if (range === "period" && date) {
      const periodPayload = await journalGenerator.generateForPeriod(date);
      return NextResponse.json({ route: ROUTE_PATH, ...periodPayload });
    }

    if (id) {
      const payload = await loadJournalPayload(id);
      if (!payload) {
        return jsonRouteError(ROUTE_PATH, 404, "Cahier journal introuvable.");
      }
      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    if (!date) {
      return jsonRouteError(ROUTE_PATH, 400, "date, id ou range requis.");
    }

    const existing = await findJournalByDate(date);
    if (existing) {
      const payload = await loadJournalPayload(existing.id);
      if (payload) {
        return NextResponse.json({ route: ROUTE_PATH, ...payload });
      }
    }

    const payload = await journalGenerator.generateForDate({ date });
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de charger le cahier journal.",
      toErrorMessage(error),
    );
  }
}
