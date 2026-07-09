import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { moveTimetableSlot, updateTimetableSlot } from "@/lib/timetable/timetable-service";
import type { TimetableMoveInput, TimetableSlotUpdateInput } from "@/lib/timetable/types";

const ROUTE_PATH = "/api/emploi-du-temps/slots";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as TimetableMoveInput;

    if (!body.scheduleId || !body.slotId || !body.targetDay || !body.targetStart || !body.targetEnd) {
      return jsonRouteError(ROUTE_PATH, 400, "Paramètres de déplacement incomplets.");
    }

    logRouteInfo(ROUTE_PATH, "Déplacement créneau", {
      scheduleId: body.scheduleId,
      slotId: body.slotId,
    });

    const payload = await moveTimetableSlot(body);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de déplacer le créneau.",
      toErrorMessage(error),
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as TimetableSlotUpdateInput;

    if (!body.scheduleId || !body.slotId) {
      return jsonRouteError(ROUTE_PATH, 400, "Paramètres de mise à jour incomplets.");
    }

    logRouteInfo(ROUTE_PATH, "Mise à jour créneau", {
      scheduleId: body.scheduleId,
      slotId: body.slotId,
    });

    const payload = await updateTimetableSlot(body);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de mettre à jour le créneau.",
      toErrorMessage(error),
    );
  }
}
