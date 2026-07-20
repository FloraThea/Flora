import { FloraAppShell } from "@/components/ui/FloraAppShell";
import { loadPilotagePayload } from "@/lib/pedagogical/intelligence/pilotage-service";
import type { PilotagePayload } from "@/lib/pedagogical/intelligence/types";
import { PedagogicalPilotage } from "./components/PedagogicalPilotage";

const EMPTY_PAYLOAD: PilotagePayload = {
  generatedAt: new Date().toISOString(),
  schoolYear: "2025-2026",
  coherence: { issues: [], issueCount: 0 },
  coverage: {
    covered: [],
    partial: [],
    missing: [],
    duplicate: [],
    coveragePercent: 0,
    totalCompetences: 0,
  },
  indicators: {
    annualProgressPercent: 0,
    competencesCovered: 0,
    competencesTotal: 0,
    hoursBalance: [],
    conflictCount: 0,
    seanceCount: 0,
    sequenceCount: 0,
    progressionCount: 0,
    programmationCount: 0,
    plannedHoursTotal: 0,
    remainingHoursTotal: 0,
    plannedProgressPercent: 0,
    byMatiere: [],
    byPeriod: [],
  },
  weeks: [],
  suggestions: [],
  recentHistory: [],
  hours: [],
  matieres: [],
};

export default async function PilotagePedagogiquePage() {
  let payload: PilotagePayload;

  try {
    payload = await loadPilotagePayload();
  } catch {
    payload = EMPTY_PAYLOAD;
  }

  return (
    <FloraAppShell>
      <PedagogicalPilotage initialPayload={payload} />
    </FloraAppShell>
  );
}
