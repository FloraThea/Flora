import { NextResponse } from "next/server";
import {
  jsonRouteError,
  logRouteInfo,
  toErrorMessage,
} from "@/lib/api/route-diagnostics";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { saveTheaCreateProposal } from "@/lib/thea/chat/thea-create-service";
import type { TheaSaveRequest, TheaSaveResponse } from "@/lib/thea/chat/types";

const ROUTE_PATH = "/api/thea/save";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TheaSaveRequest;

    if (!body.structured || !body.createContext?.matiere?.trim()) {
      return jsonRouteError(ROUTE_PATH, 400, "Proposition ou contexte incomplet.");
    }

    if (body.mode !== "create_seance" && body.mode !== "create_sequence") {
      return jsonRouteError(ROUTE_PATH, 400, "Mode d'enregistrement non pris en charge.");
    }

    logRouteInfo(ROUTE_PATH, "Enregistrement Théa", {
      mode: body.mode,
      title: body.structured.title,
    });

    const bundle = await loadTeacherProfileBundle();
    const saved = await saveTheaCreateProposal({
      mode: body.mode,
      structured: body.structured,
      createContext: body.createContext,
      bundle,
    });

    const payload: TheaSaveResponse =
      saved.type === "seance"
        ? {
            type: "seance",
            id: saved.payload.seance.id,
            title: saved.payload.seance.title,
            href: `/seances?id=${saved.payload.seance.id}`,
          }
        : {
            type: "sequence",
            id: saved.payload.sequence.id,
            title: saved.payload.sequence.title,
            href: `/sequences?id=${saved.payload.sequence.id}`,
          };

    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      error instanceof Error ? error.message : "Impossible d'enregistrer la proposition.",
      toErrorMessage(error),
    );
  }
}
