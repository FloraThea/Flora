import { NextResponse } from "next/server";
import { computeBoCoverageReport } from "@/lib/pedagogical/intelligence/bo-coverage";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matiere = searchParams.get("matiere") ?? undefined;
    const coverage = await computeBoCoverageReport(matiere || undefined);
    return NextResponse.json(coverage);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couverture BO indisponible." },
      { status: 500 },
    );
  }
}
