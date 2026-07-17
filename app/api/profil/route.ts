import { NextResponse } from "next/server";
import {
  bundleToFormValues,
  getOrCreateTeacherProfile,
  getProfileCompletionStatus,
  saveTeacherProfileBundle,
} from "@/lib/profile";
import type { ProfilSaveInput } from "@/lib/profile/types";

export async function GET() {
  try {
    const bundle = await getOrCreateTeacherProfile();
    const completion = await getProfileCompletionStatus(bundle);

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
    const bundle = await saveTeacherProfileBundle(body);
    const completion = await getProfileCompletionStatus(bundle);

    return NextResponse.json({
      values: bundleToFormValues(bundle),
      status: bundle.profile.status,
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
