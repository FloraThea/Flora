import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { listScheduleHistory } from "@/lib/timetable/timetable-service";

const ROUTE_PATH = "/api/emploi-du-temps/history";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");

    if (!scheduleId) {
      return jsonRouteError(ROUTE_PATH, 400, "scheduleId requis.");
    }

    const history = await listScheduleHistory(scheduleId);
    return NextResponse.json({ route: ROUTE_PATH, history });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de charger l'historique.",
      toErrorMessage(error),
    );
  }
}
