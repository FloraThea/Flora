import { NextResponse } from "next/server";
import { listIndependentSeances, listSeancesBySequence } from "@/lib/seances/seance-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sequenceId = searchParams.get("sequenceId");
    const independent = searchParams.get("independent") === "true";

    if (independent) {
      const seances = await listIndependentSeances();
      return NextResponse.json({ seances });
    }

    if (searchParams.get("all") === "true") {
      const { listAllSeancesForProfile } = await import("@/lib/seances/seance-service");
      const seances = await listAllSeancesForProfile();
      return NextResponse.json({ seances });
    }

    if (!sequenceId) {
      return NextResponse.json({ error: "sequenceId requis." }, { status: 400 });
    }

    const seances = await listSeancesBySequence(sequenceId);
    return NextResponse.json({ seances });
  } catch (error) {
    console.error("Erreur /api/seances/list :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger les séances." },
      { status: 500 },
    );
  }
}
