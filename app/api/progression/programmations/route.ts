import { NextResponse } from "next/server";
import { listValidatedProgrammations } from "@/lib/programming/programmation-service";

export async function GET() {
  try {
    const programmations = await listValidatedProgrammations();
    return NextResponse.json({ programmations });
  } catch (error) {
    console.error("Erreur /api/progression/programmations :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les programmations validées.",
      },
      { status: 500 },
    );
  }
}
