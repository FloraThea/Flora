import { NextResponse } from "next/server";
import { loadAnnualPlannerPayload } from "@/lib/annual-planner/planner-service";
import { swapWeekPlanning } from "@/lib/annual-planner/week-move-engine";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";

const ROUTE_PATH = "/api/planificateur-annuel/move";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fromWeekNumberInYear?: number;
      toWeekNumberInYear?: number;
    };

    const fromWeekNumberInYear = Number(body.fromWeekNumberInYear);
    const toWeekNumberInYear = Number(body.toWeekNumberInYear);

    if (!fromWeekNumberInYear || !toWeekNumberInYear) {
      return NextResponse.json(
        { route: ROUTE_PATH, error: "Semaines source et cible requises." },
        { status: 400 },
      );
    }

    const current = await loadAnnualPlannerPayload();
    const result = await swapWeekPlanning({
      calendar: current.calendar,
      progressionId: current.progressionId,
      fromWeekNumberInYear,
      toWeekNumberInYear,
    });

    if (!result.ok) {
      return NextResponse.json({ route: ROUTE_PATH, ...result }, { status: 400 });
    }

    void pedagogicalEngine.mettreAJourPlanificateur({
      fromWeekNumberInYear,
      toWeekNumberInYear,
      progressionId: current.progressionId,
    });

    const payload = await loadAnnualPlannerPayload();
    return NextResponse.json({ route: ROUTE_PATH, ...result, payload });
  } catch (error) {
    console.error("Erreur déplacement semaine :", error);
    return NextResponse.json(
      {
        route: ROUTE_PATH,
        error: error instanceof Error ? error.message : "Déplacement impossible.",
      },
      { status: 500 },
    );
  }
}
