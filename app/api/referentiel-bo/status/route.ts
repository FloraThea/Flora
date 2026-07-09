import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { getBoDocumentStatus } from "@/lib/referentiel/bo-document-service";
import { getStorageBucketHealth } from "@/lib/supabase/storage-health";

const ROUTE_PATH = "/api/referentiel-bo/status";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId") ?? undefined;

    const status = await getBoDocumentStatus(documentId);
    const storage = await getStorageBucketHealth();

    logRouteInfo(ROUTE_PATH, "Statut référentiel BO", {
      documentId: status.document?.id ?? null,
      competenceCount: status.competenceCount,
      sections: status.sections,
      active: status.document?.active_for_programmation ?? false,
      storageBucket: storage.bucket,
      storageBucketExists: storage.exists,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      ...status,
      storage,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de charger le statut du référentiel BO.",
      toErrorMessage(error),
    );
  }
}
