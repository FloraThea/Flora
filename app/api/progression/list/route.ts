import { NextResponse } from "next/server";
import { listProgressionsForProfile } from "@/lib/progression/progression-service";

export async function GET() {
  try {
    const progressions = await listProgressionsForProfile();
    return NextResponse.json({ progressions });
  } catch (error) {
    console.error("Erreur /api/progression/list :", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Impossible de charger les progressions.",
      },
      { status: 500 },
    );
  }
}
