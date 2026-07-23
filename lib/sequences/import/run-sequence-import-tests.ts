/**
 * Tests import séquences / séances — analyse multi-stratégies.
 * Usage :
 * node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/sequences/import/run-sequence-import-tests.ts
 * node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/seances/import/run-seance-import-tests.ts
 */
import assert from "node:assert/strict";
import { parseLessonDocument, buildImportSummary } from "@/lib/pedagogical/import/lesson-document-parser";
import { mapParsedImportToSequenceDrafts } from "@/lib/sequences/import/map-import-to-sequence";
import { mapParsedImportToSeanceDrafts } from "@/lib/seances/import/map-import-to-seance";

const SAMPLE_SEQUENCE_TEXT = `
Séquence 1 — Les fractions
Matière : Mathématiques
Niveau : CM2
Période : 2
Objectifs :
- Comparer des fractions
- Représenter des fractions

Séance 1 — Découvrir la moitié
Objectif : Identifier la moitié d'un ensemble
Compétence : Calculer avec des nombres
Durée : 45 min
Matériel : bandes de papier, ciseaux
Déroulement :
Accueil : rituel de calcul
Manipulation : partage de bandes en deux parts égales

Séance 2 — Comparer des fractions
Objectif : Comparer deux fractions de même dénominateur
Durée : 50 min
Évaluation : observation des productions
`;

const SAMPLE_SEANCE_TEXT = `
Séance 1 — Lecture d'un album
Matière : Français
Objectif : Comprendre un album jeunesse
Compétence : Lire seul à voix haute
Durée : 45 min
Matériel : album, fiches élèves
Déroulement :
Accueil : rappel des consignes de lecture
Manipulation : lecture en pairs
Trace écrite : comment lire avec expression
Différenciation : support visuel pour les élèves en difficulté
`;

const MULTI_SEQUENCE_TEXT = `
Séquence 1 — Additions
Objectif : Poser des additions
Séance 1 — Découverte
Objectif : Comprendre la retenue

Séquence 2 — Soustractions
Objectif : Poser des soustractions
Séance 1 — Découverte
Objectif : Comprendre l'emprunt
`;

function testSequenceTextImport() {
  return parseLessonDocument({
    fileName: "sequence.txt",
    buffer: Buffer.from(SAMPLE_SEQUENCE_TEXT),
    pastedText: SAMPLE_SEQUENCE_TEXT,
    mode: "sequence",
  }).then((parsed) => {
  assert.equal(parsed.sequences.length, 1);
  assert.equal(parsed.sequences[0]?.sessions.length, 2);
  assert.match(parsed.sequences[0]?.title.value ?? "", /fractions/i);
  assert.match(parsed.sequences[0]?.sessions[0]?.objectif.value ?? "", /moitié/i);

  const drafts = mapParsedImportToSequenceDrafts(parsed.sequences, { matiere: "Mathématiques" });
  assert.equal(drafts[0]?.sessionCount, 2);
  assert.equal(drafts[0]?.matiere, "Mathématiques");

  const summary = buildImportSummary(parsed);
  assert.equal(summary.sequenceCount, 1);
  assert.equal(summary.sessionCount, 2);
  console.log("✓ Import séquence — texte structuré");
  });
}

function testSeanceTextImport() {
  return parseLessonDocument({
    fileName: "seance.txt",
    buffer: Buffer.from(SAMPLE_SEANCE_TEXT),
    pastedText: SAMPLE_SEANCE_TEXT,
    mode: "seance",
  }).then((parsed) => {
  assert.ok(parsed.standaloneSessions.length >= 1);
  assert.match(parsed.standaloneSessions[0]?.objectif.value ?? "", /album/i);
  assert.ok(parsed.standaloneSessions[0]?.phases.length >= 1);

  const drafts = mapParsedImportToSeanceDrafts(parsed.standaloneSessions, { matiere: "Français" });
  assert.equal(drafts[0]?.matiere, "Français");
  assert.ok(drafts[0]?.phases.length >= 1);
  console.log("✓ Import séance — texte structuré avec phases");
  });
}

function testMultipleSequences() {
  return parseLessonDocument({
    fileName: "multi.txt",
    buffer: Buffer.from(MULTI_SEQUENCE_TEXT),
    pastedText: MULTI_SEQUENCE_TEXT,
    mode: "sequence",
  }).then((parsed) => {
  assert.equal(parsed.sequences.length, 2);
  assert.ok(parsed.confidence > 0.4);
  console.log("✓ Import — plusieurs séquences dans un même document");
  });
}

function testStructuredGridMapping() {
  const gridText = `
Séquence — Progression hebdomadaire
Séance 1 — Intro
Objectif : Première séance
Séance 2 — Suite
Objectif : Deuxième séance
`;
  return parseLessonDocument({
    fileName: "sequence-hebdo.txt",
    buffer: Buffer.from(gridText),
    pastedText: gridText,
    mode: "sequence",
  }).then((parsed) => {
    assert.ok(parsed.sequences.length >= 1);
    assert.ok(parsed.sequences[0]?.sessions.length >= 2);
    console.log("✓ Import — séquence hebdomadaire structurée");
  });
}

async function run() {
  await testSequenceTextImport();
  await testSeanceTextImport();
  await testMultipleSequences();
  await testStructuredGridMapping();
  console.log("Sequence/Seance import parser tests: 4/4 passed");
}

void run();
