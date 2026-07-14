import { NextResponse } from "next/server";
import { listIndependentSequences, listSequencesByProgression } from "@/lib/sequences/sequence-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const progressionId = searchParams.get("progressionId");
    const independent = searchParams.get("independent") === "true";

    if (independent) {
      const sequences = await listIndependentSequences();
      return NextResponse.json({ sequences });
    }

    if (!progressionId) {
      return NextResponse.json({ error: "progressionId requis." }, { status: 400 });
    }

    const sequences = await listSequencesByProgression(progressionId);
    return NextResponse.json({ sequences });
  } catch (error) {
    console.error("Erreur /api/sequences/list :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les séquences.",
      },
      { status: 500 },
    );
  }
}
