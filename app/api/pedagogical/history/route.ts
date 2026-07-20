import { NextResponse } from "next/server";
import {
  comparePedagogicalVersions,
  findPedagogicalSnapshot,
  listEntityPedagogicalHistory,
  listPedagogicalChanges,
} from "@/lib/pedagogical/change-history";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const anchor = searchParams.get("anchor") as "yesterday" | "last_week" | "last_month" | null;
    const leftId = searchParams.get("leftId");
    const rightId = searchParams.get("rightId");

    if (leftId && rightId) {
      const history = await listPedagogicalChanges(200);
      const left = history.find((entry) => entry.id === leftId);
      const right = history.find((entry) => entry.id === rightId);
      if (!left || !right) {
        return NextResponse.json({ error: "Versions introuvables." }, { status: 404 });
      }
      return NextResponse.json({ comparison: comparePedagogicalVersions(left, right) });
    }

    if (entityType && entityId && anchor) {
      const snapshot = await findPedagogicalSnapshot({ entityType, entityId, anchor });
      return NextResponse.json({ snapshot });
    }

    if (entityType && entityId) {
      const history = await listEntityPedagogicalHistory({ entityType, entityId });
      return NextResponse.json({ history });
    }

    const history = await listPedagogicalChanges(Number(searchParams.get("limit") ?? 50));
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Historique indisponible." },
      { status: 500 },
    );
  }
}
