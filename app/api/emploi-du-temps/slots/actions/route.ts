import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { applyTimetableSlotAction } from "@/lib/timetable/timetable-service";
import type { TimetableSlotActionInput } from "@/lib/timetable/types";

const ROUTE_PATH = "/api/emploi-du-temps/slots/actions";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TimetableSlotActionInput;

    if (!body.scheduleId || !body.action) {
      return jsonRouteError(ROUTE_PATH, 400, "Paramètres d'action incomplets.");
    }

    logRouteInfo(ROUTE_PATH, "Action créneau", {
      scheduleId: body.scheduleId,
      action: body.action,
    });

    const payload = await applyTimetableSlotAction(body);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible d'exécuter l'action sur le créneau.",
      toErrorMessage(error),
    );
  }
}
