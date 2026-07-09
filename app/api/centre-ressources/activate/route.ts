import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { activateBoDocument } from "@/lib/referentiel/bo-document-service";

const ROUTE_PATH = "/api/centre-ressources/activate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { documentId?: string };

    if (!body.documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    const document = await activateBoDocument(body.documentId);

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      documentId: document.id,
      documentStatus: document.status,
      activeForProgrammation: document.active_for_programmation,
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Activation impossible.", toErrorMessage(error));
  }
}
