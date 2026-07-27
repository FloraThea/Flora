import { NextResponse } from "next/server";
import {
  applySeanceEditAction,
  updateSeanceField,
  updateSeanceFromInput,
} from "@/lib/seances/seance-service";
import type { IndependentSeanceCreateInput, SeanceEditAction, SeanceUpdateInput } from "@/lib/seances/types";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import { triggerPedagogicalAnalysis } from "@/lib/pedagogical/intelligence/coherence-trigger";

function isFullSeanceUpdate(
  body: Record<string, unknown>,
): body is IndependentSeanceCreateInput & { seanceId: string } {
  return (
    typeof body.seanceId === "string" &&
    typeof body.title === "string" &&
    typeof body.matiere === "string" &&
    !("entityType" in body)
  );
}

export async function PATCH(request: Request) {
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;

    if ("action" in rawBody) {
      const payload = await applySeanceEditAction(rawBody.action as SeanceEditAction);
      if (payload.seance?.id) {
        void pedagogicalEngine.emit({ type: "seance.modifiee", seanceId: payload.seance.id });
        void triggerPedagogicalAnalysis({ reason: "modification", module: "seance", entityId: payload.seance.id });
      }
      return NextResponse.json(payload);
    }

    if (isFullSeanceUpdate(rawBody)) {
      const payload = await updateSeanceFromInput({
        seanceId: rawBody.seanceId,
        draftInput: rawBody,
      });
      if (payload.seance?.id) {
        void pedagogicalEngine.emit({ type: "seance.modifiee", seanceId: payload.seance.id });
        void triggerPedagogicalAnalysis({ reason: "modification", module: "seance", entityId: payload.seance.id });
      }
      return NextResponse.json(payload);
    }

    const payload = await updateSeanceField(rawBody as unknown as SeanceUpdateInput);
    if (payload.seance?.id) {
      void pedagogicalEngine.emit({ type: "seance.modifiee", seanceId: payload.seance.id });
      void triggerPedagogicalAnalysis({ reason: "modification", module: "seance", entityId: payload.seance.id });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Erreur PATCH /api/seances/update :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de mettre à jour la séance." },
      { status: 500 },
    );
  }
}
