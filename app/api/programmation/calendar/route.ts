import { NextResponse } from "next/server";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type { AcademicZone } from "@/lib/programming/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolYear = searchParams.get("schoolYear") ?? "2025-2026";
    const academicZone = (searchParams.get("zone") ?? "A") as AcademicZone;
    const includeBridgeDays = searchParams.get("includeBridgeDays") !== "false";

    const bundle = await loadTeacherProfileBundle();
    const teacherWorkingDays = bundle?.profile.workingDays;

    const calendar = schoolWeeksCalculator.calculate(schoolYear, academicZone, {
      includeBridgeDays,
      teacherWorkingDays,
    });

    return NextResponse.json({ calendar });
  } catch (error) {
    console.error("Erreur /api/programmation/calendar :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de calculer le calendrier scolaire.",
      },
      { status: 500 },
    );
  }
}
