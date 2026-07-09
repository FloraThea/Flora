import { NextResponse } from "next/server";
import { loadProgression } from "@/lib/progression/progression-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis." }, { status: 400 });
    }

    const payload = await loadProgression(id);

    if (!payload) {
      return NextResponse.json({ error: "Progression introuvable." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur /api/progression/details :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger la progression.",
      },
      { status: 500 },
    );
  }
}
