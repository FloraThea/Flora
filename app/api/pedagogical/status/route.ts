import { NextResponse } from "next/server";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";

const ROUTE_PATH = "/api/pedagogical/status";

export async function GET() {
  try {
    const [conflicts, stats, hours] = await Promise.all([
      pedagogicalEngine.detecterConflits(),
      pedagogicalEngine.recalculerStatistiques(),
      pedagogicalEngine.recalculerVolumesHoraires(),
    ]);

    return NextResponse.json({
      route: ROUTE_PATH,
      conflicts,
      stats,
      hours,
    });
  } catch (error) {
    return NextResponse.json(
      {
        route: ROUTE_PATH,
        error: error instanceof Error ? error.message : "Statut moteur indisponible.",
      },
      { status: 500 },
    );
  }
}
