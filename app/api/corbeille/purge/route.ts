import { NextResponse } from "next/server";
import { emptyTrash, permanentDeleteFromTrash } from "@/lib/trash/trash-service";
import type { TrashEntityType } from "@/lib/trash/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "one" | "empty";
      entityType?: TrashEntityType;
      id?: string;
    };

    if (body.action === "empty") {
      const deleted = await emptyTrash();
      return NextResponse.json({ success: true, deleted });
    }

    if (!body.entityType || !body.id) {
      return NextResponse.json({ error: "Type et identifiant requis." }, { status: 400 });
    }

    await permanentDeleteFromTrash({ entityType: body.entityType, id: body.id });
    return NextResponse.json({ success: true, id: body.id });
  } catch (error) {
    console.error("Erreur /api/corbeille/purge :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suppression définitive impossible." },
      { status: 500 },
    );
  }
}
