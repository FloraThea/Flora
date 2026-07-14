import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  createIndependentSeance,
  dissociateSeance,
  linkSeanceToSequence,
} from "@/lib/seances/seance-service";
import type { IndependentSeanceCreateInput, SeanceLinkInput } from "@/lib/seances/types";

const ROUTE_PATH = "/api/seances/create";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IndependentSeanceCreateInput & {
      action?: string;
      seanceId?: string;
    };

    if (body.action === "link") {
      const payload = await linkSeanceToSequence(body as unknown as SeanceLinkInput);
      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    if (body.action === "dissociate" && body.seanceId) {
      const payload = await dissociateSeance(body.seanceId);
      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    const payload = await createIndependentSeance(body);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      error instanceof Error ? error.message : "Création de séance impossible.",
      toErrorMessage(error),
    );
  }
}
