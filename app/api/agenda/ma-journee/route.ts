import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { buildMaJournee } from "@/lib/agenda/agenda-service";

const ROUTE_PATH = "/api/agenda/ma-journee";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const payload = await buildMaJournee(date);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Ma journée impossible.", toErrorMessage(error));
  }
}
