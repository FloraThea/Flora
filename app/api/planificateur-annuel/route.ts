import { NextResponse } from "next/server";
import { loadAnnualPlannerPayload } from "@/lib/annual-planner/planner-service";

const ROUTE_PATH = "/api/planificateur-annuel";

export async function GET() {
  try {
    const payload = await loadAnnualPlannerPayload();
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    console.error("Erreur planificateur annuel :", error);
    return NextResponse.json(
      {
        route: ROUTE_PATH,
        error: error instanceof Error ? error.message : "Chargement impossible.",
      },
      { status: 500 },
    );
  }
}
