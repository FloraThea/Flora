import { sortModulesByMethod } from "@/lib/progression/method-orders";
import type { SequenceContext, SequenceSession } from "./types";

function estimateSessionCount(context: SequenceContext): number {
  const objectifCount = Math.max(context.row.objectifs.length, 1);
  const weeklySessions = Math.max(context.row.sessionNumber, 1);
  return Math.max(2, Math.min(8, objectifCount + weeklySessions - 1));
}

function sessionDuration(context: SequenceContext): number {
  const subjectHours =
    context.progression.metadata?.weekly_hours ??
    context.row.metadata?.weekly_hours;

  if (typeof subjectHours === "number" && subjectHours > 0) {
    return Math.max(30, Math.round((subjectHours * 60) / Math.max(context.row.sessionNumber, 1)));
  }

  return 45;
}

/**
 * Construit le scénario pédagogique et les séances de la séquence.
 */
export class LearningScenarioBuilder {
  buildSessions(context: SequenceContext): {
    sessions: SequenceSession[];
    sessionCount: number;
    dureeEstimeeMinutes: number;
  } {
    const sessionCount = estimateSessionCount(context);
    const dureeMinutes = sessionDuration(context);
    const modules = sortModulesByMethod(
      [context.row.sequenceModule, ...context.row.objectifs],
      context.methode,
    );

    const sessions: SequenceSession[] = [];

    for (let index = 0; index < sessionCount; index += 1) {
      const moduleLabel = modules[index] ?? context.row.sequenceModule;
      const objectif =
        context.row.objectifs[index] ??
        context.row.objectifs[0] ??
        context.row.deroulement;

      sessions.push({
        sessionNumber: index + 1,
        title: `${context.row.seanceLabel || "Séance"} ${index + 1}`,
        objectif,
        dureeMinutes,
        ordrePedagogique: index + 1,
        placeProgression: `Période ${context.row.periodNumber} · Semaine ${context.row.weekNumber} · ${moduleLabel}`,
      });
    }

    return {
      sessions,
      sessionCount,
      dureeEstimeeMinutes: sessionCount * dureeMinutes,
    };
  }
}

export const learningScenarioBuilder = new LearningScenarioBuilder();
