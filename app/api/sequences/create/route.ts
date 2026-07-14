import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  createIndependentSequence,
  dissociateSequence,
  linkSequenceToProgression,
} from "@/lib/sequences/sequence-service";
import type {
  IndependentSequenceCreateInput,
  SequenceLinkInput,
} from "@/lib/sequences/types";

const ROUTE_PATH = "/api/sequences/create";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IndependentSequenceCreateInput & {
      action?: string;
    };

    if (body.action === "link") {
      const payload = await linkSequenceToProgression(body as unknown as SequenceLinkInput);
      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    if (body.action === "dissociate" && "sequenceId" in body && body.sequenceId) {
      const payload = await dissociateSequence(String(body.sequenceId));
      return NextResponse.json({ route: ROUTE_PATH, ...payload });
    }

    const payload = await createIndependentSequence(body);
    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      error instanceof Error ? error.message : "Création de séquence impossible.",
      toErrorMessage(error),
    );
  }
}
