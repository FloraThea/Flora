import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  applyTimetableRefresh,
  previewTimetableRefresh,
} from "@/lib/journal/journal-timetable-sync";

const ROUTE_PATH = "/api/cahier-journal/refresh-timetable";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      date?: string;
      apply?: boolean;
    };

    if (!body.date) {
      return jsonRouteError(ROUTE_PATH, 400, "date requise (YYYY-MM-DD).");
    }

    if (body.apply) {
      logRouteInfo(ROUTE_PATH, "Application refresh EDT", { date: body.date });
      const result = await applyTimetableRefresh(body.date);
      return NextResponse.json({ route: ROUTE_PATH, ...result, applied: true });
    }

    logRouteInfo(ROUTE_PATH, "Prévisualisation refresh EDT", { date: body.date });
    const preview = await previewTimetableRefresh(body.date);
    return NextResponse.json({ route: ROUTE_PATH, ...preview, applied: false });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible d'actualiser les horaires.",
      toErrorMessage(error),
    );
  }
}
