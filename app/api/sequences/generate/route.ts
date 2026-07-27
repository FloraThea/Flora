import { NextResponse } from "next/server";
import { sequenceGenerator } from "@/lib/sequences/SequenceGenerator";
import { findExistingGroupedSequence } from "@/lib/sequences/sequence-restitution";
import { saveSequence } from "@/lib/sequences/sequence-service";
import type { SequenceGenerationInput } from "@/lib/sequences/types";
import { floraDb } from "@/lib/supabase/get-db";
import { onlyActive } from "@/lib/trash/active-query";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SequenceGenerationInput;

    if (!body.progressionRowId) {
      return NextResponse.json({ error: "progressionRowId requis." }, { status: 400 });
    }

    const { draft, context, restitution } = await sequenceGenerator.generate(body);

    if (restitution) {
      const existingId = await findExistingGroupedSequence({
        progressionId: context.progression.id,
        groupKey: restitution.groupKey,
        groupLabel: restitution.groupLabel,
      });

      if (existingId) {
        return NextResponse.json(
          { error: `Une séquence existe déjà pour ${restitution.groupLabel}.` },
          { status: 409 },
        );
      }
    } else {
      const { data: existing } = await onlyActive(
        (await floraDb()).from("sequences").select("id").eq("progression_row_id", body.progressionRowId),
      ).maybeSingle();

      if (existing?.id) {
        return NextResponse.json(
          { error: "Une séquence existe déjà pour cette ligne de progression." },
          { status: 409 },
        );
      }
    }

    const payload = await saveSequence({
      draft,
      progressionId: context.progression.id,
      progressionRowId: body.progressionRowId,
      programmationId: context.progression.programmation_id,
      progressionTabId: context.tab.id,
      metadata: restitution
        ? {
            restitutionMode: true,
            structureDocument: restitution.structureDocument,
            sequenceGrouping: restitution.sequenceGrouping,
            sequenceGroup: restitution.groupLabel,
            sequenceGroupKey: restitution.groupKey,
            sequenceModule: restitution.sequenceModule,
            sequenceModuleKey: restitution.sequenceModuleKey,
            progressionRowIds: restitution.progressionRowIds,
          }
        : undefined,
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
