import { NextResponse } from "next/server";
import {
  updateSourceDocumentCell,
  type SourceDocumentEntityType,
} from "@/lib/import/source-document-service";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      entityType?: SourceDocumentEntityType;
      entityId?: string;
      sheetIndex?: number;
      row?: number;
      col?: number;
      displayValue?: string;
    };

    if (
      !body.entityType ||
      !body.entityId ||
      body.sheetIndex === undefined ||
      body.row === undefined ||
      body.col === undefined ||
      body.displayValue === undefined
    ) {
      return NextResponse.json({ error: "Paramètres incomplets." }, { status: 400 });
    }

    const sourceDocument = await updateSourceDocumentCell({
      entityType: body.entityType,
      entityId: body.entityId,
      sheetIndex: body.sheetIndex,
      row: body.row,
      col: body.col,
      displayValue: body.displayValue,
    });

    return NextResponse.json({ sourceDocument });
  } catch (error) {
    console.error("Erreur /api/source-document/cell :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Impossible de mettre à jour la cellule.",
      },
      { status: 500 },
    );
  }
}
