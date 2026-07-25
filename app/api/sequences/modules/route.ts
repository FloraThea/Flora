import { NextResponse } from "next/server";
import { listProgressionModules } from "@/lib/progression/progression-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const progressionId = searchParams.get("progressionId");

    if (!progressionId) {
      return NextResponse.json({ error: "progressionId requis." }, { status: 400 });
    }

    const modules = await listProgressionModules(progressionId);
    return NextResponse.json({ modules });
  } catch (error) {
    console.error("Erreur /api/sequences/modules :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les modules de progression.",
      },
      { status: 500 },
    );
  }
}
