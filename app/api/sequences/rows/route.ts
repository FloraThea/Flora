import { NextResponse } from "next/server";
import { listProgressionRows } from "@/lib/progression/progression-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const progressionId = searchParams.get("progressionId");

    if (!progressionId) {
      return NextResponse.json({ error: "progressionId requis." }, { status: 400 });
    }

    const rows = await listProgressionRows(progressionId);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Erreur /api/sequences/rows :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les lignes de progression.",
      },
      { status: 500 },
    );
  }
}
