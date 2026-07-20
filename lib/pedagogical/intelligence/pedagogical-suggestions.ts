import type { BoCoverageReport, CoherenceIssue, ExplainableSuggestion } from "./types";
import { buildExplainableSuggestions } from "./explainable-suggestions";

/** Suggestions pédagogiques dérivées des documents importés — jamais appliquées automatiquement. */
export function buildPedagogicalSuggestions(input: {
  issues: CoherenceIssue[];
  coverage: BoCoverageReport;
}): ExplainableSuggestion[] {
  const fromIssues = buildExplainableSuggestions(input.issues);
  const extra: ExplainableSuggestion[] = [];

  for (const missing of input.coverage.missing.slice(0, 8)) {
    extra.push({
      id: `remediation-${missing.referentielId}`,
      kind: "remediation",
      severity: "warning",
      title: `Remédiation : ${missing.label}`,
      message: `Prévoir une séance ou une activité courte pour aborder « ${missing.label} », absente de vos documents importés.`,
      reason: "Cette compétence du référentiel BO n'apparaît dans aucune programmation, progression ou séance.",
      sources: [{ module: "referentiel", label: missing.label }],
      competences: [missing.label],
      actionable: true,
    });
  }

  for (const duplicate of input.coverage.duplicate.slice(0, 5)) {
    extra.push({
      id: `revision-${duplicate.referentielId}`,
      kind: "revision",
      severity: "info",
      title: `Révision : ${duplicate.label}`,
      message: `Cette compétence est abordée ${duplicate.occurrences} fois. Une activité de réinvestissement ou de consolidation pourrait suffire.`,
      reason: "Flora détecte plusieurs occurrences de la même compétence dans vos progressions et séances.",
      sources: duplicate.modules.map((module) => ({ module, label: duplicate.label })),
      competences: [duplicate.label],
      actionable: true,
    });
  }

  for (const issue of input.issues) {
    if (issue.code === "sequence_sans_seance") {
      extra.push({
        id: `extra-session-${issue.entityId ?? issue.id}`,
        kind: "extra_session",
        severity: "warning",
        title: "Séance supplémentaire à prévoir",
        message: issue.proposal ?? issue.suggestion ?? "Créer les séances manquantes pour cette séquence.",
        reason: issue.reason,
        sources: issue.sources,
        competences: issue.sources.map((source) => source.label).filter(Boolean),
        actionable: true,
      });
    }

    if (issue.code === "semaine_surchargee") {
      extra.push({
        id: `differentiation-${issue.id}`,
        kind: "differentiation",
        severity: "warning",
        title: "Différenciation conseillée",
        message: "Cette semaine est très chargée : envisager une activité allégée ou un report pour une partie de la classe.",
        reason: issue.reason,
        sources: issue.sources,
        competences: [],
        actionable: true,
      });
    }

    if (issue.code.includes("eval") || issue.message.toLowerCase().includes("éval")) {
      extra.push({
        id: `evaluation-${issue.id}`,
        kind: "evaluation",
        severity: "info",
        title: "Activité d'évaluation",
        message: "Prévoir une évaluation formatrice ou sommative pour valider les acquis de la période.",
        reason: issue.reason,
        sources: issue.sources,
        competences: issue.sources.map((source) => source.label).filter(Boolean),
        actionable: true,
      });
    }

    if (issue.code === "progression_incomplete_annee") {
      extra.push({
        id: `short-activity-${issue.entityId ?? issue.id}`,
        kind: "short_activity",
        severity: "info",
        title: "Activité courte pour combler un trou",
        message: "Insérer une activité courte (15–20 min) sur les semaines non couvertes avant de reprendre le fil.",
        reason: issue.reason,
        sources: issue.sources,
        competences: [],
        actionable: true,
      });
      extra.push({
        id: `reinvestment-${issue.entityId ?? issue.id}`,
        kind: "reinvestment",
        severity: "info",
        title: "Réinvestissement des acquis",
        message: "Proposer une activité de réinvestissement en fin de période pour consolider les compétences déjà vues.",
        reason: "La progression ne couvre pas encore toute l'année scolaire.",
        sources: issue.sources,
        competences: [],
        actionable: true,
      });
    }
  }

  const merged = [...fromIssues, ...extra];
  const seen = new Set<string>();
  return merged.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 24);
}
