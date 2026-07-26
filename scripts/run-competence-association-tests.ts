import assert from "node:assert/strict";
import { associateCompetencesFromCandidates } from "@/lib/pedagogical/competence-association/associate-competences";
import { buildContentProfile } from "@/lib/pedagogical/competence-association/build-content-profile";
import type { BoCompetenceCandidate, PedagogicalContentInput } from "@/lib/pedagogical/competence-association/types";

const CANDIDATES: BoCompetenceCandidate[] = [
  {
    id: "math-1",
    competence: "Comparer et dénombrer des collections en les organisant.",
    code: null,
    discipline: "Mathématiques",
    domaine: "Nombres, calcul et résolution de problèmes",
    sousDomaine: "Les nombres entiers",
    niveau: "CP",
    cycle: "Cycle 2",
    section: "Nombres, calcul et résolution de problèmes",
    sourceExcerpt: "Comparer et dénombrer des collections en les organisant.",
    documentSourceId: "doc-1",
  },
  {
    id: "math-2",
    competence: "Reconnaitre et tracer des figures géométriques simples.",
    code: null,
    discipline: "Mathématiques",
    domaine: "Espace et géométrie",
    sousDomaine: "La géométrie plane",
    niveau: "CP",
    cycle: "Cycle 2",
    section: "Espace et géométrie",
    sourceExcerpt: null,
    documentSourceId: "doc-1",
  },
];

const CONTENT: PedagogicalContentInput = {
  entityType: "seance",
  matiere: "Mathématiques",
  niveau: "CP",
  cycle: "Cycle 2",
  methode: "MHM",
  moduleLabel: "Module 1",
  seanceLabel: "Séance 2",
  title: "Organiser des collections pour comparer et dénombrer",
  objectifs: ["Comparer des collections", "Organiser des objets par dizaines et unités"],
  deroulement: "Manipulation de jetons, constitution de collections, comparaison de quantités.",
  competences: ["collections", "dénombrer"],
};

function testContentProfileBuildsWeightedText() {
  const profile = buildContentProfile(CONTENT);
  assert.ok(profile.fullText.includes("Organiser des collections"));
  assert.ok(profile.tokens.length > 5);
  assert.equal(profile.contentHash.length, 24);
}

function testAssociationPrefersRelevantCompetence() {
  const result = associateCompetencesFromCandidates({
    content: CONTENT,
    candidates: CANDIDATES,
    limit: 2,
    minConfidence: 0.35,
  });

  assert.ok(result.primary, "Une compétence principale doit être proposée");
  assert.equal(result.primary?.referentielId, "math-1");
  assert.ok((result.primary?.confidence ?? 0) > 0.4);
  assert.ok(result.primary?.explanation.length > 0);
  assert.match(result.primary?.competenceText ?? "", /Comparer et dénombrer/);
}

function testAssociationNeverReformulatesCompetenceText() {
  const result = associateCompetencesFromCandidates({
    content: CONTENT,
    candidates: CANDIDATES,
    limit: 2,
    minConfidence: 0.35,
  });

  for (const proposal of result.proposals) {
    const candidate = CANDIDATES.find((item) => item.id === proposal.referentielId);
    assert.equal(proposal.competenceText, candidate?.competence);
  }
}

function main() {
  testContentProfileBuildsWeightedText();
  testAssociationPrefersRelevantCompetence();
  testAssociationNeverReformulatesCompetenceText();
  console.log("Competence association tests passed.");
}

main();
