import { NextResponse } from "next/server";
import { loadSeance } from "@/lib/seances/seance-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id requis." }, { status: 400 });
    }

    const payload = await loadSeance(id);
    if (!payload) {
      return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur /api/seances/details :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger la séance." },
      { status: 500 },
    );
  }
}
