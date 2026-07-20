import { NextResponse } from "next/server";
import { moveToTrash } from "@/lib/trash/trash-service";
import type { TrashEntityType } from "@/lib/trash/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      entityType?: TrashEntityType;
      id?: string;
      reason?: string;
    };

    if (!body.entityType || !body.id) {
      return NextResponse.json({ error: "Type et identifiant requis." }, { status: 400 });
    }

    await moveToTrash({
      entityType: body.entityType,
      id: body.id,
      reason: body.reason,
    });

    return NextResponse.json({ success: true, id: body.id });
  } catch (error) {
    console.error("Erreur /api/corbeille/trash :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de placer dans la Corbeille." },
      { status: 500 },
    );
  }
}
