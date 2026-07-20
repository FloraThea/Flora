import "server-only";

import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { listPedagogicalChanges } from "../change-history";
import { recalculateHourVolumes, recalculatePedagogicalStats } from "../hours-calculator";
import { analyzePedagogicalCoherence } from "./coherence-analyzer";
import {
  coherenceCacheKey,
  getPedagogicalCache,
  pilotageCacheKey,
  setPedagogicalCache,
} from "./coherence-cache";
import { computeBoCoverageReport } from "./bo-coverage";
import { buildPedagogicalSuggestions } from "./pedagogical-suggestions";
import { buildExtendedIndicators } from "./indicators";
import { buildWeeklyPilotage } from "./weekly-pilotage";
import type { CoherenceIssue, PilotagePayload } from "./types";

export async function loadPilotagePayload(matiere?: string): Promise<PilotagePayload> {
  const scope = await requireTeacherScope();
  const cacheKey = pilotageCacheKey(scope.profileId, matiere);
  const cached = getPedagogicalCache<PilotagePayload>(cacheKey);
  if (cached) return cached;

  const bundle = await loadTeacherProfileBundle();

  let issues = getPedagogicalCache<CoherenceIssue[]>(coherenceCacheKey(scope.profileId));
  if (!issues) {
    issues = await analyzePedagogicalCoherence();
    setPedagogicalCache(coherenceCacheKey(scope.profileId), issues, 120_000);
  }

  const [coverage, weeks, hours, recentHistory] = await Promise.all([
    computeBoCoverageReport(matiere),
    buildWeeklyPilotage(),
    recalculateHourVolumes(),
    listPedagogicalChanges(30),
  ]);

  const baseStats = await recalculatePedagogicalStats(issues.length);
  const indicators = await buildExtendedIndicators(baseStats, issues.length, weeks.length);

  const matieres = [
    ...new Set([
      ...indicators.byMatiere.map((row) => row.matiere).filter(Boolean),
      ...weeks.flatMap((week) => week.subjects),
    ]),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  const payload: PilotagePayload = {
    generatedAt: new Date().toISOString(),
    schoolYear: bundle?.profile.schoolYear ?? "2025-2026",
    coherence: { issues, issueCount: issues.length },
    coverage,
    indicators,
    weeks,
    suggestions: buildPedagogicalSuggestions({ issues, coverage }),
    recentHistory,
    hours,
    matieres,
  };

  setPedagogicalCache(cacheKey, payload, 90_000);
  return payload;
}

export async function loadPilotageWeekSlice(input: {
  offset?: number;
  limit?: number;
  matiere?: string;
}): Promise<{ weeks: PilotagePayload["weeks"]; total: number; offset: number; limit: number }> {
  const payload = await loadPilotagePayload(input.matiere);
  const offset = Math.max(input.offset ?? 0, 0);
  const limit = Math.min(Math.max(input.limit ?? 12, 1), 36);
  const weeks =
    input.matiere && input.matiere !== "all"
      ? payload.weeks.filter((week) => week.subjects.includes(input.matiere!))
      : payload.weeks;

  return {
    weeks: weeks.slice(offset, offset + limit),
    total: weeks.length,
    offset,
    limit,
  };
}
