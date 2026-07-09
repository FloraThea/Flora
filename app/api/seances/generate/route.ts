import { NextResponse } from "next/server";
import { lessonGenerator } from "@/lib/seances/LessonGenerator";
import { getSeanceBySessionId } from "@/lib/seances/seance-service";
import type { SeanceGenerationInput } from "@/lib/seances/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SeanceGenerationInput;

    if (!body.sequenceSessionId && !body.sequenceId) {
      return NextResponse.json(
        { error: "sequenceSessionId ou sequenceId requis." },
        { status: 400 },
      );
    }

    if (body.sequenceSessionId) {
      const existing = await getSeanceBySessionId(body.sequenceSessionId);
      if (existing) {
        return NextResponse.json(
          { error: "Une séance existe déjà pour cette session de séquence." },
          { status: 409 },
        );
      }
    }

    const result = await lessonGenerator.generate(body);

    if (Array.isArray(result)) {
      return NextResponse.json({ payloads: result, count: result.length });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erreur /api/seances/generate :", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Impossible de générer la séance.",
      },
      { status: 500 },
    );
  }
}
