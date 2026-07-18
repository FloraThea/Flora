import { NextResponse } from "next/server";
import { listProgrammationsForProfile } from "@/lib/programming/programmation-service";

export async function GET() {
  try {
    const programmations = await listProgrammationsForProfile();
    return NextResponse.json({ programmations });
  } catch (error) {
    console.error("Erreur /api/programmation/list :", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Impossible de charger les programmations.",
      },
      { status: 500 },
    );
  }
}
