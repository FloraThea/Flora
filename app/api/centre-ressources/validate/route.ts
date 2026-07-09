import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { finalizeBoReferentiel } from "@/lib/referentiel/bo-pipeline";

const ROUTE_PATH = "/api/centre-ressources/validate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { documentId?: string };

    if (!body.documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    const result = await finalizeBoReferentiel(body.documentId);

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      documentId: result.document.id,
      documentStatus: result.document.status,
      insertedCount: result.insertedCount,
      validation: result.validation,
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Validation impossible.", toErrorMessage(error));
  }
}
