import { NextResponse } from "next/server";
import { loadPilotagePayload, loadPilotageWeekSlice } from "@/lib/pedagogical/intelligence/pilotage-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matiere = searchParams.get("matiere") ?? undefined;
    const weekOffset = searchParams.get("weekOffset");
    const weekLimit = searchParams.get("weekLimit");

    if (weekOffset !== null || weekLimit !== null) {
      const slice = await loadPilotageWeekSlice({
        matiere: matiere || undefined,
        offset: Number(weekOffset ?? 0),
        limit: Number(weekLimit ?? 12),
      });
      return NextResponse.json(slice);
    }

    const payload = await loadPilotagePayload(matiere || undefined);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pilotage indisponible." },
      { status: 500 },
    );
  }
}
