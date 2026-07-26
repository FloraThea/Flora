import { NextResponse } from "next/server";
import { associateCompetences } from "@/lib/pedagogical/competence-association/associate-competences";
import { inferEntityType } from "@/lib/pedagogical/competence-association/build-input";
import type { PedagogicalContentInput } from "@/lib/pedagogical/competence-association/types";
import { loadTeacherProfileForGeneration } from "@/lib/profile/profile-context";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PedagogicalContentInput & {
      teacherProfileId?: string;
      limit?: number;
      minConfidence?: number;
    };

    if (!body.matiere?.trim()) {
      return NextResponse.json({ error: "matiere requis." }, { status: 400 });
    }

    const teacherProfile = await loadTeacherProfileForGeneration();
    const content: PedagogicalContentInput = {
      ...body,
      entityType: inferEntityType(body.entityType),
    };

    const result = await associateCompetences({
      content,
      teacherProfileId: body.teacherProfileId ?? teacherProfile.profile.id,
      limit: body.limit ?? 5,
      minConfidence: body.minConfidence ?? 0.45,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erreur /api/competences/associate :", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Association de compétences impossible.",
      },
      { status: 500 },
    );
  }
}
