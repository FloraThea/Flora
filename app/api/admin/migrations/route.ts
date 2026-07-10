import { NextRequest, NextResponse } from "next/server";

import { getAdminAuthHint, isAdminActionAllowed } from "@/lib/db/admin-auth";
import { applyPendingMigrations, getMigrationStatus } from "@/lib/db/migrations";
import { isAdministrationEnabled } from "@/lib/env/admin-access";

export async function GET() {
  if (!isAdministrationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const status = await getMigrationStatus();
    return NextResponse.json({
      ...status,
      adminAuthHint: getAdminAuthHint(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de lire l'état des migrations.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdministrationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdminActionAllowed(request)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Action non autorisée. Définissez FLORA_ADMIN_SECRET et transmettez-le via x-flora-admin-secret.",
      },
      { status: 403 },
    );
  }

  try {
    const result = await applyPendingMigrations();
    const status = await getMigrationStatus();

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          applied: result.applied,
          skipped: result.skipped,
          error: result.error,
          ...status,
          adminAuthHint: getAdminAuthHint(),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      applied: result.applied,
      skipped: result.skipped,
      ...status,
      adminAuthHint: getAdminAuthHint(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur lors de l'application des migrations.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
