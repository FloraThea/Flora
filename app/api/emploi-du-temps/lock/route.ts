import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { applyTimetableLock } from "@/lib/timetable/timetable-service";
import type { TimetableLockInput } from "@/lib/timetable/types";

const ROUTE_PATH = "/api/emploi-du-temps/lock";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TimetableLockInput;

    if (!body.scheduleId || !body.day || !body.scope) {
      return jsonRouteError(ROUTE_PATH, 400, "scheduleId, day et scope requis.");
    }

    logRouteInfo(ROUTE_PATH, body.locked ? "Verrouillage" : "Déverrouillage", body);

    const payload = await applyTimetableLock(body);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de modifier le verrouillage.",
      toErrorMessage(error),
    );
  }
}
