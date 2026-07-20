import type { CoherenceIssue, ExplainableSuggestion } from "./types";

export function buildExplainableSuggestions(
  coherenceIssues: CoherenceIssue[],
): ExplainableSuggestion[] {
  return coherenceIssues.slice(0, 20).map((issue) => ({
    id: `suggestion-${issue.id}`,
    kind: mapKind(issue.code),
    severity: issue.severity === "error" ? "alert" : issue.severity,
    title: issue.message,
    message: issue.proposal ?? issue.suggestion ?? "Vérifier ce point dans vos documents.",
    reason: issue.reason,
    sources: issue.sources,
    competences: issue.sources
      .map((source) => source.label)
      .filter((label) => label.length > 8 && label.length < 120),
    actionable: true,
  }));
}

function mapKind(code: string): ExplainableSuggestion["kind"] {
  if (code.includes("competence")) return "remediation";
  if (code.includes("seance")) return "extra_session";
  if (code.includes("eval")) return "evaluation";
  if (code.includes("incomplete")) return "revision";
  if (code.includes("surcharge")) return "differentiation";
  return "coherence";
}
