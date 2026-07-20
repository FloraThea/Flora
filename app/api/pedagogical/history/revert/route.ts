import { NextResponse } from "next/server";
import { revertPedagogicalChange } from "@/lib/pedagogical/change-history";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { logId?: string };
    if (!body.logId) {
      return NextResponse.json({ error: "logId requis." }, { status: 400 });
    }

    const result = await revertPedagogicalChange(body.logId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Restauration impossible." },
      { status: 500 },
    );
  }
}
