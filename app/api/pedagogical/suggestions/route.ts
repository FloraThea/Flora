import { NextResponse } from "next/server";
import { loadPilotagePayload } from "@/lib/pedagogical/intelligence/pilotage-service";
import { buildPedagogicalSuggestions } from "@/lib/pedagogical/intelligence/pedagogical-suggestions";

export async function GET() {
  try {
    const payload = await loadPilotagePayload();
    const suggestions = buildPedagogicalSuggestions({
      issues: payload.coherence.issues,
      coverage: payload.coverage,
    });
    return NextResponse.json({ suggestions, count: suggestions.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suggestions indisponibles." },
      { status: 500 },
    );
  }
}
