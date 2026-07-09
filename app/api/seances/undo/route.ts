import { NextResponse } from "next/server";
import { undoLastSeanceEdit } from "@/lib/seances/seance-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { seanceId: string };

    if (!body.seanceId) {
      return NextResponse.json({ error: "seanceId requis." }, { status: 400 });
    }

    const payload = await undoLastSeanceEdit(body.seanceId);
    if (!payload) {
      return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur POST /api/seances/undo :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'annuler la modification." },
      { status: 500 },
    );
  }
}
