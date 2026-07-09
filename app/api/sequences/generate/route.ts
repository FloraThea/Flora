import { NextResponse } from "next/server";
import { sequenceGenerator } from "@/lib/sequences/SequenceGenerator";
import { saveSequence } from "@/lib/sequences/sequence-service";
import type { SequenceGenerationInput } from "@/lib/sequences/types";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SequenceGenerationInput;

    if (!body.progressionRowId) {
      return NextResponse.json({ error: "progressionRowId requis." }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("sequences")
      .select("id")
      .eq("progression_row_id", body.progressionRowId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json(
        { error: "Une séquence existe déjà pour cette ligne de progression." },
        { status: 409 },
      );
    }

    const { draft, context } = await sequenceGenerator.generate(body);

    const payload = await saveSequence({
      draft,
      progressionId: context.progression.id,
      progressionRowId: body.progressionRowId,
      programmationId: context.progression.programmation_id,
      progressionTabId: context.tab.id,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur /api/sequences/generate :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de générer la séquence.",
      },
      { status: 500 },
    );
  }
}
