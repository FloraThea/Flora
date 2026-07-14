import assert from "node:assert/strict";
import { buildIndependentSequenceDraft, resolveSequenceLinkMode } from "./independent-sequence-factory";
import {
  buildEmptySeancePhases,
  buildIndependentSeanceDraft,
  resolveSeanceLinkMode,
} from "../seances/independent-seance-factory";

function testIndependentSequenceDraft() {
  const draft = buildIndependentSequenceDraft({
    title: "Séquence test",
    matiere: "Français",
    sessionCount: 2,
  });

  assert.equal(draft.title, "Séquence test");
  assert.equal(draft.sessions.length, 2);
  assert.equal(resolveSequenceLinkMode({ title: "x", matiere: "y" }), "independent");
}

function testIndependentSeanceDraft() {
  const draft = buildIndependentSeanceDraft({
    title: "Séance test",
    matiere: "Mathématiques",
    dureeMinutes: 45,
  });

  assert.equal(draft.title, "Séance test");
  assert.equal(draft.phases.length, 10);
  assert.equal(resolveSeanceLinkMode({ title: "x", matiere: "y" }), "independent");
}

function testSeancePhasesDuration() {
  const phases = buildEmptySeancePhases(60);
  const total = phases.reduce((sum, phase) => sum + phase.dureeMinutes, 0);
  assert.ok(total >= 55 && total <= 65);
}

function runIndependentPedagogicalTests() {
  testIndependentSequenceDraft();
  testIndependentSeanceDraft();
  testSeancePhasesDuration();
  console.log("Independent pedagogical tests: 3/3 passed");
}

runIndependentPedagogicalTests();
