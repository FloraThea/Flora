import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { upsertObservation } from "@/lib/journal/journal-service";

const ROUTE_PATH = "/api/cahier-journal/observations";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      journalEntryId?: string;
      status?: "realisee" | "partielle" | "non_realisee";
      actualMinutes?: number | null;
      comments?: string;
      difficulties?: string;
      successes?: string;
      followUp?: string;
    };

    if (!body.journalEntryId || !body.status) {
      return jsonRouteError(ROUTE_PATH, 400, "journalEntryId et status requis.");
    }

    const observation = await upsertObservation({
      journalEntryId: body.journalEntryId,
      status: body.status,
      actualMinutes: body.actualMinutes,
      comments: body.comments,
      difficulties: body.difficulties,
      successes: body.successes,
      followUp: body.followUp,
    });
    return NextResponse.json({ route: ROUTE_PATH, observation });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible d'enregistrer l'observation.",
      toErrorMessage(error),
    );
  }
}
