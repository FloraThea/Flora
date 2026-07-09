import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  createScheduleVersion,
  listScheduleVersions,
  restoreScheduleVersion,
} from "@/lib/timetable/timetable-service";

const ROUTE_PATH = "/api/emploi-du-temps/versions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");

    if (!scheduleId) {
      return jsonRouteError(ROUTE_PATH, 400, "scheduleId requis.");
    }

    const versions = await listScheduleVersions(scheduleId);
    return NextResponse.json({ route: ROUTE_PATH, versions });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de charger les versions.",
      toErrorMessage(error),
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      scheduleId?: string;
      label?: string;
      restoreVersionId?: string;
    };

    if (body.restoreVersionId) {
      logRouteInfo(ROUTE_PATH, "Restauration version", { versionId: body.restoreVersionId });
      const payload = await restoreScheduleVersion(body.restoreVersionId);
      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    if (!body.scheduleId) {
      return jsonRouteError(ROUTE_PATH, 400, "scheduleId requis.");
    }

    logRouteInfo(ROUTE_PATH, "Création version", { scheduleId: body.scheduleId });
    const version = await createScheduleVersion(body.scheduleId, body.label ?? "");
    return NextResponse.json({ route: ROUTE_PATH, version });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de gérer la version.",
      toErrorMessage(error),
    );
  }
}
