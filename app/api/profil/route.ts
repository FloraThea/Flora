import { NextResponse } from "next/server";
import {
  bundleToFormValues,
  getOrCreateTeacherProfile,
  getProfileCompletionStatus,
  reloadTeacherProfileBundle,
  saveTeacherProfileBundle,
} from "@/lib/profile";
import { edtImportTrace } from "@/lib/timetable/import/edt-import-trace";
import type { ProfilSaveInput } from "@/lib/profile/types";

export async function GET() {
  try {
    const bundle = await getOrCreateTeacherProfile();
    const completion = await getProfileCompletionStatus(bundle);
    edtImportTrace("EDT-15", {
      profileId: bundle.profile.id,
      status: completion.complete ? "profile_complete" : "profile_incomplete",
      slotCount: completion.missing.includes("Emploi du temps actif (module Emploi du temps)") ? 0 : undefined,
      error: completion.missing.length ? completion.missing.join("; ") : undefined,
    });

    return NextResponse.json({
      values: bundleToFormValues(bundle),
      status: bundle.profile.status,
      completion,
    });
  } catch (error) {
    console.error("Erreur GET /api/profil :", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de charger le profil." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as ProfilSaveInput;
    const saved = await saveTeacherProfileBundle(body);
    const verified = await reloadTeacherProfileBundle(saved.profile.id);

    if (!verified) {
      return NextResponse.json(
        { error: "Le profil n'a pas pu être relu après l'enregistrement." },
        { status: 500 },
      );
    }

    const completion = await getProfileCompletionStatus(verified);

    return NextResponse.json({
      values: bundleToFormValues(verified),
      status: verified.profile.status,
      completion,
    });
  } catch (error) {
    console.error("Erreur PUT /api/profil :", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'enregistrer le profil." },
      { status: 500 },
    );
  }
}
