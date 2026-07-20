import { NextResponse } from "next/server";
import { trashProgression } from "@/lib/progression/progression-service";

/** Déplace la progression dans la Corbeille (suppression logique). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; reason?: string };

    if (!body.id) {
      return NextResponse.json({ error: "Identifiant de progression requis." }, { status: 400 });
    }

    await trashProgression(body.id, body.reason);

    return NextResponse.json({
      success: true,
      id: body.id,
      message: "Progression placée dans la Corbeille.",
    });
  } catch (error) {
    console.error("Erreur /api/progression/delete :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de placer la progression dans la Corbeille.",
      },
      { status: 500 },
    );
  }
}
