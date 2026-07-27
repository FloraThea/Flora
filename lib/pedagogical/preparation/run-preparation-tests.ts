/**
 * Tests utilitaires préparation pédagogique (déroulement, mappers).
 * Usage : node node_modules/tsx/dist/cli.mjs lib/pedagogical/preparation/run-preparation-tests.ts
 */
import assert from "node:assert/strict";
import {
  buildPhasesFromDeroulement,
  buildSessionDetailFromProgressionRow,
  deroulementSummary,
  emptyDeroulementSteps,
  parseSessionPreparationDetail,
  serializeSessionPreparationDetail,
} from "./deroulement-utils";
import { mapSeanceFormToCreateInput, mapSequenceFormToCreateInput } from "./form-mappers";

function testDeroulementSteps() {
  const steps = emptyDeroulementSteps();
  assert.equal(steps.length, 6);
  steps[0] = { ...steps[0]!, content: "Problème du jour" };
  const phases = buildPhasesFromDeroulement(steps, 45);
  assert.equal(phases.length, 1);
  assert.match(phases[0]!.summary, /Problème du jour/);
  console.log("✓ Déroulement → phases séance");
}

function testSessionDetailFromProgressionRow() {
  const detail = buildSessionDetailFromProgressionRow({
    competenceBo: "Calculer",
    objectifs: ["Additionner", "Vérifier"],
    deroulement: "Manipulation des jetons",
    materiel: ["Jetons"],
    resources: ["Guide p. 4"],
    referentielIds: ["ref-1"],
  });
  const serialized = serializeSessionPreparationDetail(detail);
  const parsed = parseSessionPreparationDetail(serialized);
  assert.equal(parsed.competences[0], "Calculer");
  assert.equal(parsed.materiel[0], "Jetons");
  assert.ok(parsed.deroulement[0]!.content.includes("Manipulation"));
  console.log("✓ Détail séance progression → metadata");
}

function testFormMappers() {
  const seanceInput = mapSeanceFormToCreateInput({
    title: "Séance test",
    matiere: "Mathématiques",
    sousMatiere: "Nombres",
    niveau: "CE2",
    cycle: "",
    sessionDate: "",
    dureeMinutes: 45,
    competences: ["Calculer"],
    referentielIds: ["ref-1"],
    objectif: "Additionner",
    deroulement: emptyDeroulementSteps(),
    materiel: ["Jetons"],
    resources: ["Guide"],
    resourceIds: ["doc-1"],
  });
  assert.equal(seanceInput.competenceBo, "Calculer");
  assert.equal(seanceInput.referentielIds?.[0], "ref-1");

  const sequenceInput = mapSequenceFormToCreateInput({
    title: "Séquence test",
    matiere: "Français",
    sousMatiere: "Grammaire",
    niveau: "CE1",
    cycle: "",
    competences: ["Identifier"],
    referentielIds: [],
    objectifGeneral: "Reconnaître le verbe",
    deroulementGeneral: emptyDeroulementSteps(),
    materiel: [],
    resources: [],
    resourceIds: [],
    sessions: [
      {
        sessionNumber: 1,
        title: "Séance 1",
        objectif: "Observer",
        dureeMinutes: 45,
        competences: ["Identifier"],
        referentielIds: [],
        deroulement: emptyDeroulementSteps(),
        materiel: [],
        resources: [],
        resourceIds: [],
      },
    ],
  });
  assert.equal(sequenceInput.sessions?.length, 1);
  assert.equal(sequenceInput.objectifs?.[0], "Reconnaître le verbe");
  console.log("✓ Mappers formulaire → create input");
}

function testDeroulementSummary() {
  const summary = deroulementSummary([
    { key: "a", label: "Recherche", content: "Les élèves cherchent" },
    { key: "b", label: "Mise en commun", content: "" },
  ]);
  assert.match(summary, /Recherche/);
  assert.doesNotMatch(summary, /Mise en commun/);
  console.log("✓ Résumé déroulement");
}

function runPreparationTests() {
  testDeroulementSteps();
  testSessionDetailFromProgressionRow();
  testFormMappers();
  testDeroulementSummary();
  console.log("Preparation tests: 4/4 passed");
}

runPreparationTests();
