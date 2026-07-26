import { loadReferentielCompetences } from "@/lib/referentiel/referentiel-service";
import { buildContentProfile } from "./build-content-profile";
import { loadFeedbackBoosts } from "./feedback-service";
import {
  buildProposalExplanation,
  filterCandidates,
  proposalStatus,
  scoreCompetenceCandidate,
} from "./score-candidate";
import type {
  BoCompetenceCandidate,
  CompetenceAssociationProposal,
  CompetenceAssociationResult,
  PedagogicalContentInput,
} from "./types";

async function loadCandidates(input: PedagogicalContentInput): Promise<BoCompetenceCandidate[]> {
  const rows = await loadReferentielCompetences({
    matiere: input.matiere,
    levels: input.niveau ? [input.niveau] : [],
    cycle: input.cycle,
    label: "competence-association",
    requireBoDocument: true,
  });

  return rows.map((row) => ({
    id: row.id,
    competence: row.competence,
    code: row.code ?? null,
    discipline: row.discipline ?? null,
    domaine: row.domaine ?? null,
    sousDomaine: row.sousDomaine ?? null,
    niveau: row.niveau ?? null,
    cycle: row.cycle ?? null,
    section: row.section ?? null,
    sourceExcerpt: row.sourceExcerpt ?? null,
    documentSourceId: row.documentSourceId ?? null,
  }));
}

export function associateCompetencesFromCandidates(input: {
  content: PedagogicalContentInput;
  candidates: BoCompetenceCandidate[];
  feedbackBoosts?: Map<string, number>;
  limit?: number;
  minConfidence?: number;
}): CompetenceAssociationResult {
  const profile = buildContentProfile(input.content);
  const filtered = filterCandidates(input.candidates, input.content);
  const limit = input.limit ?? 5;
  const minConfidence = input.minConfidence ?? 0.45;

  const proposals: CompetenceAssociationProposal[] = filtered
    .map((candidate) => {
      const feedbackBoost = input.feedbackBoosts?.get(candidate.id) ?? 0;
      const scored = scoreCompetenceCandidate({
        profile,
        candidate,
        content: input.content,
        feedbackBoost: Math.max(0, feedbackBoost),
      });

      return {
        referentielId: candidate.id,
        competenceText: candidate.competence,
        confidence: scored.confidence,
        rank: 0,
        explanation: buildProposalExplanation(scored.signals, candidate),
        signals: scored.signals,
        hierarchy: {
          cycle: candidate.cycle ?? input.content.cycle ?? "",
          niveau: candidate.niveau ?? input.content.niveau ?? "",
          matiere: candidate.discipline ?? input.content.matiere,
          sousMatiere: candidate.domaine ?? input.content.sousMatiere ?? "",
          sousSousMatiere: candidate.sousDomaine ?? "",
        },
        status: proposalStatus(scored.confidence),
      };
    })
    .filter((proposal) => proposal.confidence >= minConfidence)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, limit)
    .map((proposal, index) => ({ ...proposal, rank: index + 1 }));

  return {
    proposals,
    primary: proposals[0] ?? null,
    contentProfile: {
      contentHash: profile.contentHash,
      fullText: profile.fullText,
    },
    candidateCount: input.candidates.length,
    filteredCount: filtered.length,
  };
}

export async function associateCompetences(input: {
  content: PedagogicalContentInput;
  teacherProfileId?: string;
  limit?: number;
  minConfidence?: number;
}): Promise<CompetenceAssociationResult> {
  const candidates = await loadCandidates(input.content);
  const feedbackBoosts = await loadFeedbackBoosts({
    teacherProfileId: input.teacherProfileId,
    contentHash: buildContentProfile(input.content).contentHash,
    matiere: input.content.matiere,
  });

  return associateCompetencesFromCandidates({
    content: input.content,
    candidates,
    feedbackBoosts,
    limit: input.limit,
    minConfidence: input.minConfidence,
  });
}

export function mapCandidatesFromReferentiel(
  referentiel: Array<{
    id: string;
    competence: string;
    code?: string | null;
    discipline?: string | null;
    domaine?: string | null;
    niveau?: string | null;
    section?: string | null;
  }>,
): BoCompetenceCandidate[] {
  return referentiel.map((row) => ({
    id: row.id,
    competence: row.competence,
    code: row.code ?? null,
    discipline: row.discipline ?? null,
    domaine: row.domaine ?? null,
    sousDomaine: null,
    niveau: row.niveau ?? null,
    cycle: null,
    section: row.section ?? null,
    sourceExcerpt: null,
    documentSourceId: null,
  }));
}
