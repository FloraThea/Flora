import { NextResponse } from "next/server";
import { recordCompetenceFeedback } from "@/lib/pedagogical/competence-association/feedback-service";
import { inferEntityType } from "@/lib/pedagogical/competence-association/build-input";
import type { CompetenceFeedbackInput } from "@/lib/pedagogical/competence-association/types";
import { loadTeacherProfileForGeneration } from "@/lib/profile/profile-context";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CompetenceFeedbackInput>;

    if (!body.contentHash || !body.action) {
      return NextResponse.json({ error: "contentHash et action requis." }, { status: 400 });
    }

    const teacherProfile = await loadTeacherProfileForGeneration();

    await recordCompetenceFeedback({
      teacherProfileId: body.teacherProfileId ?? teacherProfile.profile.id,
      entityType: inferEntityType(body.entityType),
      entityId: body.entityId,
      contentHash: body.contentHash,
      matiere: body.matiere,
      niveau: body.niveau,
      methode: body.methode,
      proposedReferentielId: body.proposedReferentielId,
      finalReferentielId: body.finalReferentielId,
      action: body.action,
      confidence: body.confidence,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur /api/competences/feedback :", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Enregistrement du feedback impossible.",
      },
      { status: 500 },
    );
  }
}
