import { NextResponse } from "next/server";
import { getProgressionDependencies } from "@/lib/progression/progression-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Paramètre id requis." }, { status: 400 });
    }

    const dependencies = await getProgressionDependencies(id);

    return NextResponse.json({ dependencies });
  } catch (error) {
    console.error("Erreur /api/progression/dependencies :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'analyser les dépendances de la progression.",
      },
      { status: 500 },
    );
  }
}
