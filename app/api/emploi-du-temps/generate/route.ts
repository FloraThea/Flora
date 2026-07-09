import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import { generateTimetable } from "@/lib/timetable/timetable-service";
import type { TimetableGenerateInput } from "@/lib/timetable/types";

const ROUTE_PATH = "/api/emploi-du-temps/generate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TimetableGenerateInput;

    logRouteInfo(ROUTE_PATH, "Génération EDT", {
      scheduleId: body.scheduleId,
      variantType: body.variantType,
    });

    const payload = await generateTimetable(body);
    void pedagogicalEngine.emit({ type: "emploi_du_temps.modifie", scope: "generate" });
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de générer l'emploi du temps.",
      toErrorMessage(error),
    );
  }
}
