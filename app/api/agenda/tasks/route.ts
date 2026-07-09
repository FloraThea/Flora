import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  convertTaskToEvent,
  createAgendaTask,
  listAgendaTasks,
  updateAgendaTask,
} from "@/lib/agenda/agenda-service";
import type { CreateAgendaTaskInput } from "@/lib/agenda/types";

const ROUTE_PATH = "/api/agenda/tasks";

export async function GET() {
  try {
    const tasks = await listAgendaTasks();
    return NextResponse.json({ route: ROUTE_PATH, tasks });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Tâches impossible.", toErrorMessage(error));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAgendaTaskInput & {
      action?: string;
      taskId?: string;
      status?: "todo" | "in_progress" | "done";
    };

    if (body.action === "convert" && body.taskId) {
      const event = await convertTaskToEvent(body.taskId);
      return NextResponse.json({ route: ROUTE_PATH, event });
    }

    if (body.action === "update" && body.taskId) {
      const task = await updateAgendaTask(body.taskId, body);
      return NextResponse.json({ route: ROUTE_PATH, task });
    }

    logRouteInfo(ROUTE_PATH, "Création tâche", { title: body.title });
    const task = await createAgendaTask(body);
    return NextResponse.json({ route: ROUTE_PATH, task });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Tâche impossible.", toErrorMessage(error));
  }
}
