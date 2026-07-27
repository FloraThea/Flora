import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { updateSequenceFromInput } from "@/lib/sequences/sequence-service";
import type { IndependentSequenceCreateInput } from "@/lib/sequences/types";

const ROUTE_PATH = "/api/sequences/update";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as IndependentSequenceCreateInput & {
      sequenceId: string;
    };

    if (!body.sequenceId) {
      return NextResponse.json({ error: "sequenceId requis." }, { status: 400 });
    }

    const payload = await updateSequenceFromInput({
      sequenceId: body.sequenceId,
      draftInput: body,
    });

    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      error instanceof Error ? error.message : "Impossible de mettre à jour la séquence.",
      toErrorMessage(error),
    );
  }
}
