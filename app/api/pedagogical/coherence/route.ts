import { NextResponse } from "next/server";
import { analyzePedagogicalCoherence } from "@/lib/pedagogical/intelligence/coherence-analyzer";

export async function GET() {
  try {
    const issues = await analyzePedagogicalCoherence();
    return NextResponse.json({ issues, issueCount: issues.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analyse de cohérence indisponible." },
      { status: 500 },
    );
  }
}
