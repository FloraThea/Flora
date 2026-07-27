import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { loadReferentielCompetences } from "@/lib/referentiel/referentiel-service";
import type { ReferentielOptionsPayload } from "@/lib/pedagogical/preparation/types";

const ROUTE_PATH = "/api/referentiel/options";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matiere = searchParams.get("matiere") ?? "";
    const niveau = searchParams.get("niveau") ?? "";
    const sousMatiere = searchParams.get("sousMatiere") ?? "";

    if (!matiere.trim()) {
      return NextResponse.json({ domaines: [], competences: [] });
    }

    const levels = niveau.trim() ? niveau.split(/[,/]/).map((value) => value.trim()).filter(Boolean) : [];
    const rows = await loadReferentielCompetences({
      matiere,
      levels,
      requireBoDocument: false,
    });

    const domaines = [
      ...new Set(rows.map((row) => row.domaine).filter(Boolean)),
    ] as string[];

    const filtered = sousMatiere.trim()
      ? rows.filter((row) => row.domaine === sousMatiere.trim())
      : rows;

    const payload: ReferentielOptionsPayload = {
      domaines,
      competences: filtered.map((row) => ({
        id: row.id,
        competence: row.competence,
        domaine: row.domaine,
        code: row.code,
        niveau: row.niveau,
      })),
    };

    return NextResponse.json({ route: ROUTE_PATH, ...payload });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de charger les options du référentiel.",
      toErrorMessage(error),
    );
  }
}
