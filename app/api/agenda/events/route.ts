import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  createAgendaEvent,
  deleteAgendaEvent,
  moveAgendaEvent,
} from "@/lib/agenda/agenda-service";
import type { CreateAgendaEventInput } from "@/lib/agenda/types";

const ROUTE_PATH = "/api/agenda/events";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAgendaEventInput & {
      action?: string;
      eventId?: string;
      targetDate?: string;
    };

    if (body.action === "delete" && body.eventId) {
      await deleteAgendaEvent(body.eventId);
      return NextResponse.json({ route: ROUTE_PATH, success: true });
    }

    if (body.action === "move" && body.eventId && body.targetDate) {
      const event = await moveAgendaEvent(body.eventId, body.targetDate);
      return NextResponse.json({ route: ROUTE_PATH, event });
    }

    logRouteInfo(ROUTE_PATH, "Création événement", { title: body.title });
    const event = await createAgendaEvent(body);

    return NextResponse.json({ route: ROUTE_PATH, event });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Événement impossible.", toErrorMessage(error));
  }
}
