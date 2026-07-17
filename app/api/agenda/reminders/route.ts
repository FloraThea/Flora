import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { dismissAgendaReminder, listPendingReminders, markReminderSent } from "@/lib/agenda/agenda-service";

const ROUTE_PATH = "/api/agenda/reminders";

export async function GET() {
  try {
    const reminders = await listPendingReminders();
    return NextResponse.json({ route: ROUTE_PATH, reminders });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Rappels impossible.", toErrorMessage(error));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { reminderId?: string; action?: string };

    if (body.action === "dismiss" && body.reminderId) {
      await dismissAgendaReminder(body.reminderId);
      return NextResponse.json({ route: ROUTE_PATH, success: true });
    }

    if (body.action === "sent" && body.reminderId) {
      await markReminderSent(body.reminderId);
      return NextResponse.json({ route: ROUTE_PATH, success: true });
    }

    return jsonRouteError(ROUTE_PATH, 400, "Action non reconnue.");
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Rappel impossible.", toErrorMessage(error));
  }
}
