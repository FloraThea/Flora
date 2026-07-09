import { NextResponse } from "next/server";
import { updateProgressionRow } from "@/lib/progression/progression-service";
import type { ProgressionRow } from "@/lib/progression/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rowId?: string;
      row?: Partial<ProgressionRow>;
    };

    if (!body.rowId || !body.row) {
      return NextResponse.json({ error: "rowId et row requis." }, { status: 400 });
    }

    await updateProgressionRow(body.rowId, {
      objectifs: body.row.objectifs ?? [],
      deroulement: body.row.deroulement ?? "",
      materiel: body.row.materiel ?? [],
      resources: body.row.resources ?? [],
      remarques: body.row.remarques ?? "",
      commentaires: body.row.commentaires ?? "",
      competenceBo: body.row.competenceBo ?? "",
      sequenceModule: body.row.sequenceModule ?? "",
      seanceLabel: body.row.seanceLabel ?? "",
      referentielIds: body.row.referentielIds ?? [],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur /api/progression/row :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour la ligne.",
      },
      { status: 500 },
    );
  }
}
