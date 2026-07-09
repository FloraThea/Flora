import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { getStorageBucketHealth } from "@/lib/supabase/storage-health";

const ROUTE_PATH = "/api/referentiel-bo/storage-health";

export async function GET() {
  try {
    const health = await getStorageBucketHealth();

    logRouteInfo(ROUTE_PATH, "Vérification bucket storage", {
      bucket: health.bucket,
      exists: health.exists,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      ...health,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de vérifier le bucket Supabase Storage.",
      toErrorMessage(error),
    );
  }
}
