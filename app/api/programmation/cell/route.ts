import { NextResponse } from "next/server";
import { updateProgrammingCell } from "@/lib/programming/programmation-service";
import type { ProgrammingCellContent } from "@/lib/programming/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cellId?: string;
      cell?: ProgrammingCellContent;
    };

    if (!body.cellId || !body.cell) {
      return NextResponse.json(
        { error: "cellId et cell requis." },
        { status: 400 },
      );
    }

    await updateProgrammingCell(body.cellId, body.cell);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur /api/programmation/cell :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour la cellule.",
      },
      { status: 500 },
    );
  }
}
