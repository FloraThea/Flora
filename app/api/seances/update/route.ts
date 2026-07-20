import { NextResponse } from "next/server";
import { applySeanceEditAction, updateSeanceField } from "@/lib/seances/seance-service";
import type { SeanceEditAction, SeanceUpdateInput } from "@/lib/seances/types";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import { triggerPedagogicalAnalysis } from "@/lib/pedagogical/intelligence/coherence-trigger";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as
      | SeanceUpdateInput
      | { action: SeanceEditAction };

    if ("action" in body) {
      const payload = await applySeanceEditAction(body.action);
      if (payload.seance?.id) {
        void pedagogicalEngine.emit({ type: "seance.modifiee", seanceId: payload.seance.id });
        void triggerPedagogicalAnalysis({ reason: "modification", module: "seance", entityId: payload.seance.id });
      }
      return NextResponse.json(payload);
    }

    const payload = await updateSeanceField(body);
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
