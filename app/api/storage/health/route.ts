import { NextResponse } from "next/server";
import { isDevOnlyRouteEnabled } from "@/lib/env/admin-access";
import {
  formatMissingR2EnvMessage,
  getMissingR2EnvVars,
  getStorageProviderName,
  storageService,
  tryGetR2Config,
} from "@/lib/storage";
import { buildR2Diagnostics, logR2Diagnostics } from "@/lib/storage/r2-diagnostics";

export async function GET() {
  if (!isDevOnlyRouteEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  logR2Diagnostics("[storage/health]");

  const provider = getStorageProviderName();
  const diagnostics = buildR2Diagnostics();
  const missing = getMissingR2EnvVars();
  const r2Config = tryGetR2Config();

  if (provider === "cloudflare_r2" && missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        ...diagnostics,
        missingEnv: missing,
        error: formatMissingR2EnvMessage(missing),
      },
      { status: 503 },
    );
  }

  if (provider === "cloudflare_r2" && diagnostics.credentialError) {
    return NextResponse.json(
      {
        ok: false,
        ...diagnostics,
        error: diagnostics.credentialError,
      },
      { status: 503 },
    );
  }

  try {
    const prefix = r2Config ? `documents/` : "";
    const listed = prefix
      ? await storageService.list(prefix, { maxKeys: 1 }, provider === "supabase" ? "supabase" : "cloudflare_r2")
      : { keys: [], prefixes: [], isTruncated: false };

    return NextResponse.json({
      ok: true,
      ...diagnostics,
      region: r2Config?.region ?? "auto",
      listedSample: listed.keys.slice(0, 3),
      message:
        provider === "cloudflare_r2"
          ? `Connexion Cloudflare R2 opérationnelle (bucket « ${r2Config?.bucketName} »).`
          : "Mode legacy Supabase Storage actif.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de connexion storage.";
    const statusCode =
      error instanceof Error && "cloudflare" in error
        ? (error as { cloudflare?: { statusCode?: number } }).cloudflare?.statusCode
        : undefined;

    return NextResponse.json(
      {
        ok: false,
        ...diagnostics,
        httpStatus: statusCode ?? null,
        error: message,
        hint:
          statusCode === 401
            ? "HTTP 401 : vérifiez que vous utilisez des clés S3 R2 (32+64 hex), que le Secret n'est pas tronqué, " +
              "et que le token R2 a les droits Lecture/Écriture sur le bucket « flora-documents » du même compte."
            : null,
      },
      { status: 500 },
    );
  }
}
