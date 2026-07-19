import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  ensureActiveSchedule,
  listSchedules,
  loadTimetablePayload,
  saveScheduleSettings,
} from "@/lib/timetable/timetable-service";
import { getOrCreateTeacherProfile } from "@/lib/profile/profile-service";
import type { TimetableSettings } from "@/lib/timetable/types";

const ROUTE_PATH = "/api/emploi-du-temps";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const payload = await loadTimetablePayload(id);
      if (!payload) {
        return jsonRouteError(ROUTE_PATH, 404, "Emploi du temps introuvable.");
      }
      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    const bundle = await getOrCreateTeacherProfile();
    const payload = await ensureActiveSchedule();
    const schedules = await listSchedules(bundle.profile.id);

    return NextResponse.json({ route: ROUTE_PATH, ...payload, schedules });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de charger l'emploi du temps.",
      toErrorMessage(error),
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      scheduleId?: string;
      settings?: TimetableSettings;
      weeklyHours?: Record<string, number>;
    };

    if (!body.scheduleId || !body.settings) {
      return jsonRouteError(ROUTE_PATH, 400, "scheduleId et settings requis.");
    }

    logRouteInfo(ROUTE_PATH, "Mise à jour paramètres EDT", { scheduleId: body.scheduleId });

    const payload = await saveScheduleSettings(
      body.scheduleId,
      body.settings,
      body.weeklyHours,
    );

    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de sauvegarder les paramètres.",
      toErrorMessage(error),
    );
  }
}
