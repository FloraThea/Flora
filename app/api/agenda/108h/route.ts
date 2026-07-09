import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { createHours108Entry, getHours108Dashboard } from "@/lib/agenda/agenda-service";
import type { CreateHours108EntryInput } from "@/lib/agenda/types";

const ROUTE_PATH = "/api/agenda/108h";

export async function GET() {
  try {
    const dashboard = await getHours108Dashboard();
    return NextResponse.json({ route: ROUTE_PATH, dashboard });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "108h impossible.", toErrorMessage(error));
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateHours108EntryInput;
    logRouteInfo(ROUTE_PATH, "Saisie 108h", { category: body.categoryCode });
    const entry = await createHours108Entry(body);
    const dashboard = await getHours108Dashboard();
    return NextResponse.json({ route: ROUTE_PATH, entry, dashboard });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Saisie 108h impossible.", toErrorMessage(error));
  }
}
