import type { SeanceDraft, SeancePayload } from "./types";
import { LESSON_PHASES } from "./types";

export type SeanceValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
};

export type SeanceValidationResult = {
  valid: boolean;
  issues: SeanceValidationIssue[];
};

/**
 * Valide qu'une séance générée est complète et exploitable.
 */
export class LessonValidator {
  validateDraft(draft: SeanceDraft): SeanceValidationResult {
    const issues: SeanceValidationIssue[] = [];

    if (!draft.title.trim()) {
      issues.push({ code: "missing_title", severity: "error", message: "Titre manquant." });
    }
    if (!draft.objectif.trim()) {
      issues.push({ code: "missing_objectif", severity: "error", message: "Objectif manquant." });
    }
    if (draft.phases.length < LESSON_PHASES.length) {
      issues.push({
        code: "incomplete_deroulement",
        severity: "error",
        message: "Déroulé incomplet.",
      });
    }
    if (draft.phases.some((phase) => phase.activities.length === 0)) {
      issues.push({
        code: "missing_activities",
        severity: "warning",
        message: "Certaines phases n'ont pas d'activité.",
      });
    }
    if (!draft.traceEcrite.eleve.trim()) {
      issues.push({
        code: "missing_trace",
        severity: "warning",
        message: "Trace écrite élève manquante.",
      });
    }

    return {
      valid: issues.every((issue) => issue.severity !== "error"),
      issues,
    };
  }

  validatePayload(payload: SeancePayload): SeanceValidationResult {
    return this.validateDraft({
      ...payload.seance,
      phases: payload.phases,
    });
  }
}

export const lessonValidator = new LessonValidator();
