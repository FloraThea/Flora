import { NextResponse } from "next/server";
import { listValidatedProgressions } from "@/lib/progression/progression-service";

export async function GET() {
  try {
    const progressions = await listValidatedProgressions();
    return NextResponse.json({ progressions });
  } catch (error) {
    console.error("Erreur /api/sequences/progressions :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger les progressions validées.",
      },
      { status: 500 },
    );
  }
}
