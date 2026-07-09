import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { loadAgendaFeed } from "@/lib/agenda/agenda-service";

const ROUTE_PATH = "/api/agenda/feed";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return jsonRouteError(ROUTE_PATH, 400, "Paramètres start et end requis.");
    }

    logRouteInfo(ROUTE_PATH, "Chargement feed agenda", { start, end });
    const payload = await loadAgendaFeed(start, end);

    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Feed agenda impossible.", toErrorMessage(error));
  }
}
