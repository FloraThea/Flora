import { NextResponse } from "next/server";
import { listTrashItems } from "@/lib/trash/trash-service";
import type { TrashEntityType } from "@/lib/trash/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("type") as TrashEntityType | "all" | null;
    const matiere = searchParams.get("matiere");
    const deletedAfter = searchParams.get("deletedAfter");

    const items = await listTrashItems({
      entityType: entityType ?? "all",
      matiere: matiere ?? undefined,
      deletedAfter: deletedAfter ?? undefined,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erreur /api/corbeille/list :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger la Corbeille." },
      { status: 500 },
    );
  }
}
