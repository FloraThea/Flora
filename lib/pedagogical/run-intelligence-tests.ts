import assert from "node:assert/strict";
import { buildExplainableSuggestions } from "./intelligence/explainable-suggestions";
import { buildPedagogicalSuggestions } from "./intelligence/pedagogical-suggestions";
import type { BoCoverageReport, CoherenceIssue } from "./intelligence/types";

function sampleIssue(overrides: Partial<CoherenceIssue> = {}): CoherenceIssue {
  return {
    id: "issue-1",
    code: "seance_sans_objectif",
    severity: "warning",
    message: "Séance sans objectif",
    suggestion: "Compléter l'objectif",
    module: "seances",
    entityId: "seance-1",
    reason: "Une séance sans objectif rend le suivi difficile.",
    sources: [{ module: "seances", entityId: "seance-1", label: "Fractions" }],
    proposal: "Renseigner l'objectif depuis la progression.",
    ...overrides,
  };
}

const emptyCoverage: BoCoverageReport = {
  covered: [],
  partial: [],
  missing: [],
  duplicate: [],
  coveragePercent: 0,
  totalCompetences: 0,
};

function testExplainableSuggestions() {
  const suggestions = buildExplainableSuggestions([
    sampleIssue(),
    sampleIssue({
      id: "issue-2",
      code: "competence_oubliee",
      message: "Compétence oubliée",
    }),
  ]);

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0]?.actionable, true);
  assert.ok(suggestions[0]?.reason.length > 0);
  assert.ok(suggestions[0]?.sources.length > 0);
  assert.equal(suggestions[1]?.kind, "remediation");
}

function testPedagogicalSuggestionsFromBo() {
  const suggestions = buildPedagogicalSuggestions({
    issues: [sampleIssue({ code: "progression_incomplete_annee", id: "issue-3" })],
    coverage: {
      ...emptyCoverage,
      missing: [
        {
          referentielId: "ref-1",
          label: "Comparer des fractions",
          status: "missing",
          modules: [],
        },
      ],
    },
  });

  assert.ok(suggestions.some((item) => item.kind === "remediation"));
  assert.ok(suggestions.some((item) => item.kind === "revision" || item.kind === "short_activity"));
}

function testSuggestionLimit() {
  const issues = Array.from({ length: 30 }, (_, index) =>
    sampleIssue({ id: `issue-${index}`, message: `Alerte ${index}` }),
  );
  const suggestions = buildPedagogicalSuggestions({ issues, coverage: emptyCoverage });
  assert.ok(suggestions.length <= 24);
}

function testCoherenceIssueCodes() {
  const suggestions = buildPedagogicalSuggestions({
    issues: [
      sampleIssue({ code: "semaine_surchargee", id: "overload" }),
      sampleIssue({ code: "sequence_sans_seance", id: "seq", entityId: "seq-1" }),
    ],
    coverage: emptyCoverage,
  });

  assert.ok(suggestions.some((item) => item.kind === "differentiation"));
  assert.ok(suggestions.some((item) => item.kind === "extra_session"));
}

function runIntelligenceTests() {
  testExplainableSuggestions();
  testPedagogicalSuggestionsFromBo();
  testSuggestionLimit();
  testCoherenceIssueCodes();
  console.log("MPI 2.0 intelligence tests: 4/4 passed");
}

runIntelligenceTests();
