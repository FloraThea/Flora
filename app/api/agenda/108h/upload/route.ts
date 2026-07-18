import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { floraDb } from "@/lib/supabase/get-db";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { build108hStoragePath, getStorageBucketName } from "@/lib/supabase/storage-config";
import { checkStorageBucketExists } from "@/lib/supabase/storage-health";

const ROUTE_PATH = "/api/agenda/108h/upload";

export async function POST(request: Request) {
  try {
    const bundle = await loadTeacherProfileBundle();
    if (!bundle) {
      return jsonRouteError(ROUTE_PATH, 401, "Profil enseignant requis.");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return jsonRouteError(ROUTE_PATH, 400, "Fichier requis.");
    }

    const bucket = getStorageBucketName();
    const bucketExists = await checkStorageBucketExists(bucket);
    if (!bucketExists) {
      return jsonRouteError(
        ROUTE_PATH,
        503,
        `Bucket Supabase « ${bucket} » introuvable. Créez-le pour joindre des pièces.`,
      );
    }

    const storagePath = build108hStoragePath(bundle.profile.id, file.name);
    logRouteInfo(ROUTE_PATH, "Upload pièce jointe 108h", { storagePath });

    const { error: uploadError } = await (await floraDb()).storage.from(bucket).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      return jsonRouteError(
        ROUTE_PATH,
        500,
        getSupabaseErrorMessage(uploadError, "Upload impossible."),
      );
    }

    const { data: publicData } = (await floraDb()).storage.from(bucket).getPublicUrl(storagePath);

    return NextResponse.json({
      route: ROUTE_PATH,
      attachmentUrl: publicData.publicUrl,
      storagePath,
      fileName: file.name,
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Upload impossible.", toErrorMessage(error));
  }
}
