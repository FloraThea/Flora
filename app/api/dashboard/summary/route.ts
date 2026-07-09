import { NextResponse } from "next/server";
import { getProfileCompletionStatus } from "@/lib/profile/profile-context";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { supabase } from "@/lib/supabase";

const ROUTE_PATH = "/api/dashboard/summary";

export async function GET() {
  try {
    const bundle = await loadTeacherProfileBundle();
    const today = new Date().toISOString().slice(0, 10);

    const [
      { count: documentsCount },
      { count: programmationsCount },
      { count: boDocumentsCount },
      { count: seancesToday },
    ] = await Promise.all([
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("programmations").select("id", { count: "exact", head: true }),
      supabase.from("bo_documents").select("id", { count: "exact", head: true }),
      supabase.from("seances").select("id", { count: "exact", head: true }).eq("session_date", today),
    ]);

    if (!bundle) {
      return NextResponse.json({
        route: ROUTE_PATH,
        profileComplete: false,
        missingFields: ["Profil enseignant"],
        prenom: "",
        levels: [],
        schoolYear: "",
        seancesToday: seancesToday ?? 0,
        documentsCount: documentsCount ?? 0,
        programmationsCount: programmationsCount ?? 0,
        boDocumentsCount: boDocumentsCount ?? 0,
      });
    }

    const status = getProfileCompletionStatus(bundle);

    return NextResponse.json({
      route: ROUTE_PATH,
      profileComplete: status.complete,
      missingFields: status.missing,
      prenom: bundle.profile.prenom,
      levels: bundle.profile.levels,
      schoolYear: bundle.profile.schoolYear,
      seancesToday: seancesToday ?? 0,
      documentsCount: documentsCount ?? 0,
      programmationsCount: programmationsCount ?? 0,
      boDocumentsCount: boDocumentsCount ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        route: ROUTE_PATH,
        profileComplete: false,
        missingFields: ["Profil"],
        prenom: "",
        levels: [],
        schoolYear: "",
        seancesToday: 0,
        documentsCount: 0,
        programmationsCount: 0,
        boDocumentsCount: 0,
        error: error instanceof Error ? error.message : "Erreur",
      },
      { status: 200 },
    );
  }
}
