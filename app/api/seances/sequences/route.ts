import { NextResponse } from "next/server";
import { listSequencesWithSeances } from "@/lib/seances/seance-service";

export async function GET() {
  try {
    const sequences = await listSequencesWithSeances();
    return NextResponse.json({ sequences });
  } catch (error) {
    console.error("Erreur /api/seances/sequences :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger les séquences." },
      { status: 500 },
    );
  }
}
