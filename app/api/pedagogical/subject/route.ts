import { NextResponse } from "next/server";
import { updateProgrammationSubject } from "@/lib/programming/programmation-service";
import { updateProgressionSubject } from "@/lib/progression/progression-service";
import { updateSequenceSubject } from "@/lib/sequences/sequence-service";
import { updateSeanceSubject } from "@/lib/seances/seance-service";

type EntityType = "programmation" | "progression" | "sequence" | "seance";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      entityType?: EntityType;
      entityId?: string;
      matiere?: string;
      sousMatiere?: string;
      niveau?: string;
      periode?: string;
    };

    if (!body.entityType || !body.entityId || body.matiere === undefined) {
      return NextResponse.json({ error: "Paramètres incomplets." }, { status: 400 });
    }

    const input = {
      matiere: body.matiere,
      sousMatiere: body.sousMatiere ?? "",
      niveau: body.niveau ?? "",
      periode: body.periode ?? "",
    };

    switch (body.entityType) {
      case "programmation":
        await updateProgrammationSubject(body.entityId, input);
        break;
      case "progression":
        await updateProgressionSubject(body.entityId, input);
        break;
      case "sequence":
        await updateSequenceSubject(body.entityId, input);
        break;
      case "seance":
        await updateSeanceSubject(body.entityId, input);
        break;
      default:
        return NextResponse.json({ error: "Type de document non supporté." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erreur /api/pedagogical/subject :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de mettre à jour la matière." },
      { status: 500 },
    );
  }
}
