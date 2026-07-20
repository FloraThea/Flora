import { NextResponse } from "next/server";
import { emptyTrash, restoreAllTrash } from "@/lib/trash/trash-service";
import { purgeExpiredTrashItems } from "@/lib/trash/purge-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "restore-all" | "empty" | "purge-expired";
    };

    if (body.action === "restore-all") {
      const restored = await restoreAllTrash();
      return NextResponse.json({ success: true, restored });
    }

    if (body.action === "empty") {
      const deleted = await emptyTrash();
      return NextResponse.json({ success: true, deleted });
    }

    const report = await purgeExpiredTrashItems();
    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("Erreur /api/corbeille/bulk :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action impossible." },
      { status: 500 },
    );
  }
}
