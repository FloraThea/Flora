import { NextResponse } from "next/server";
import { getRestoreConflict, restoreFromTrash } from "@/lib/trash/trash-service";
import type { TrashEntityType, TrashRestoreMode } from "@/lib/trash/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as TrashEntityType | null;
    const id = searchParams.get("id");

    if (!entityType || !id) {
      return NextResponse.json({ error: "Paramètres entityType et id requis." }, { status: 400 });
    }

    const conflict = await getRestoreConflict(entityType, id);
    return NextResponse.json({ conflict });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'analyser la restauration." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      entityType?: TrashEntityType;
      id?: string;
      mode?: TrashRestoreMode;
    };

    if (!body.entityType || !body.id) {
      return NextResponse.json({ error: "Type et identifiant requis." }, { status: 400 });
    }

    const result = await restoreFromTrash({
      entityType: body.entityType,
      id: body.id,
      mode: body.mode,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Erreur /api/corbeille/restore :", error);
    const message = error instanceof Error ? error.message : "Impossible de restaurer.";
    const status = message.includes("Corbeille") ? 409 : 500;
    return NextResponse.json({ error: message, requiresChoice: status === 409 }, { status });
  }
}
