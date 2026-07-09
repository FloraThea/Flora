import { NextResponse } from "next/server";
import { loadSequence } from "@/lib/sequences/sequence-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis." }, { status: 400 });
    }

    const payload = await loadSequence(id);

    if (!payload) {
      return NextResponse.json({ error: "Séquence introuvable." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur /api/sequences/details :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger la séquence.",
      },
      { status: 500 },
    );
  }
}
