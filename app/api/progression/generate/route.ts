import { NextResponse } from "next/server";
import { progressionGenerator } from "@/lib/progression/ProgressionGenerator";
import { progressionValidator } from "@/lib/progression/ProgressionValidator";
import { saveProgressionWithSync } from "@/lib/progression/progression-service";
import type { ProgressionGenerationInput } from "@/lib/progression/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProgressionGenerationInput;

    if (!body.programmationId) {
      return NextResponse.json(
        { error: "Programmation validée requise." },
        { status: 400 },
      );
    }

    const generated = await progressionGenerator.generate(body);
    const validation = progressionValidator.validate(generated.tabs, generated.context);

    const payload = await saveProgressionWithSync({
      title: generated.title,
      programmationId: body.programmationId,
      methode: generated.context.methode,
      calendarSnapshot: generated.context.calendar,
      validation,
      tabs: generated.tabs,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur /api/progression/generate :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de générer la progression.",
      },
      { status: 500 },
    );
  }
}
