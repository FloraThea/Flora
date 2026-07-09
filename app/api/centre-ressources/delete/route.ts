import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { deleteBoDocument } from "@/lib/referentiel/bo-document-service";

const ROUTE_PATH = "/api/centre-ressources/delete";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { documentId?: string };

    if (!body.documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    logRouteInfo(ROUTE_PATH, "Suppression document BO", { documentId: body.documentId });

    await deleteBoDocument(body.documentId);

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      documentId: body.documentId,
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Suppression impossible.", toErrorMessage(error));
  }
}
