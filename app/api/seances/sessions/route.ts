import { NextResponse } from "next/server";
import { listSequenceSessions } from "@/lib/seances/seance-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sequenceId = searchParams.get("sequenceId");

    if (!sequenceId) {
      return NextResponse.json({ error: "sequenceId requis." }, { status: 400 });
    }

    const sessions = await listSequenceSessions(sequenceId);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Erreur /api/seances/sessions :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger les sessions." },
      { status: 500 },
    );
  }
}
