"use client";

import { useCallback, useEffect, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { ApiFetchDiagnosticError, fetchApiWithDiagnostics } from "@/lib/api/client-fetch";
import {
  buildAssociationInputFromSeanceDraft,
  buildAssociationInputFromSequenceDraft,
} from "@/lib/pedagogical/competence-association/build-input";
import type {
  CompetenceAssociationProposal,
  CompetenceAssociationResult,
  PedagogicalContentInput,
} from "@/lib/pedagogical/competence-association/types";

export type CompetenceAssociationSelection = {
  competenceBo: string;
  referentielIds: string[];
  proposal: CompetenceAssociationProposal;
  contentHash: string;
};

type CompetenceProposalPanelProps = {
  content: PedagogicalContentInput;
  currentCompetence?: string;
  currentReferentielIds?: string[];
  autoLoad?: boolean;
  limit?: number;
  onAccept: (selection: CompetenceAssociationSelection) => void;
  onModify?: (selection: CompetenceAssociationSelection) => void;
  className?: string;
};

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function statusLabel(status: CompetenceAssociationProposal["status"]): string {
  switch (status) {
    case "high":
      return "Forte correspondance";
    case "medium":
      return "Correspondance probable";
    default:
      return "Correspondance faible";
  }
}

function statusAccent(status: CompetenceAssociationProposal["status"]): "sage" | "lavender" | "rose" {
  switch (status) {
    case "high":
      return "sage";
    case "medium":
      return "lavender";
    default:
      return "rose";
  }
}

async function recordFeedback(input: {
  content: PedagogicalContentInput;
  contentHash: string;
  action: "accepted" | "replaced" | "rejected";
  proposal?: CompetenceAssociationProposal | null;
  finalReferentielId?: string | null;
}) {
  await fetchApiWithDiagnostics(
    "/api/competences/feedback",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityType: input.content.entityType,
        entityId: input.content.entityId,
        contentHash: input.contentHash,
        matiere: input.content.matiere,
        niveau: input.content.niveau,
        methode: input.content.methode,
        action: input.action,
        proposedReferentielId: input.proposal?.referentielId ?? null,
        finalReferentielId: input.finalReferentielId ?? input.proposal?.referentielId ?? null,
        confidence: input.proposal?.confidence,
      }),
    },
    { label: "CompetenceProposalPanel" },
  );
}

export function CompetenceProposalPanel({
  content,
  currentCompetence,
  currentReferentielIds = [],
  autoLoad = false,
  limit = 5,
  onAccept,
  onModify,
  className = "",
}: CompetenceProposalPanelProps) {
  const [result, setResult] = useState<CompetenceAssociationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    if (!content.matiere?.trim()) {
      setError("Indiquez une matière pour obtenir des propositions.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await fetchApiWithDiagnostics<CompetenceAssociationResult>(
        "/api/competences/associate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...content, limit }),
        },
        { label: "CompetenceProposalPanel" },
      );
      setResult(payload);
      setExpandedProposalId(payload.primary?.referentielId ?? payload.proposals[0]?.referentielId ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof ApiFetchDiagnosticError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les propositions.",
      );
    } finally {
      setLoading(false);
    }
  }, [content, limit]);

  useEffect(() => {
    if (autoLoad) {
      void loadProposals();
    }
  }, [autoLoad, loadProposals]);

  async function handleAccept(proposal: CompetenceAssociationProposal) {
    if (!result) return;

    const selection: CompetenceAssociationSelection = {
      competenceBo: proposal.competenceText,
      referentielIds: [proposal.referentielId],
      proposal,
      contentHash: result.contentProfile.contentHash,
    };

    try {
      const isReplace =
        currentReferentielIds.length > 0 &&
        !currentReferentielIds.includes(proposal.referentielId);
      await recordFeedback({
        content,
        contentHash: result.contentProfile.contentHash,
        action: isReplace ? "replaced" : "accepted",
        proposal: result.primary ?? proposal,
        finalReferentielId: proposal.referentielId,
      });
    } catch {
      // Le choix enseignant reste appliqué même si le feedback échoue.
    }

    onAccept(selection);
  }

  async function handleModify(proposal: CompetenceAssociationProposal) {
    if (!result) return;

    const selection: CompetenceAssociationSelection = {
      competenceBo: proposal.competenceText,
      referentielIds: [proposal.referentielId],
      proposal,
      contentHash: result.contentProfile.contentHash,
    };

    onModify?.(selection);
  }

  const selectedReferentielId = currentReferentielIds[0];

  return (
    <div className={`rounded-2xl border border-white/70 bg-white/45 p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-flora-text">Compétences BO proposées</p>
          <p className="text-xs font-light text-flora-text-subtle">
            Classement par correspondance avec le contenu pédagogique
          </p>
        </div>
        <FloraButton
          accent="lavender"
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={() => void loadProposals()}
        >
          {loading ? "Analyse…" : result ? "Actualiser" : "Suggérer"}
        </FloraButton>
      </div>

      {error ? <p className="mb-3 text-xs font-light text-[#b88989]">{error}</p> : null}

      {result && result.proposals.length === 0 ? (
        <p className="text-sm font-light text-flora-text-subtle">
          Aucune compétence BO suffisamment proche. Saisissez la compétence manuellement ou enrichissez
          les objectifs et le déroulement.
        </p>
      ) : null}

      {result?.proposals.length ? (
        <div className="space-y-3">
          <p className="text-xs font-light text-flora-text-subtle">
            {result.filteredCount} candidat(s) analysé(s) · {result.proposals.length} proposition(s)
          </p>

          {result.proposals.map((proposal) => {
            const isSelected = selectedReferentielId === proposal.referentielId;
            const isCurrentText = currentCompetence?.trim() === proposal.competenceText.trim();
            const isExpanded = expandedProposalId === proposal.referentielId;

            return (
              <article
                key={proposal.referentielId}
                className={`rounded-2xl border px-4 py-3 transition ${
                  isSelected || isCurrentText
                    ? "border-sauge/50 bg-sauge-light/20"
                    : "border-white/60 bg-white/55"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <FloraBadge accent={statusAccent(proposal.status)} size="sm">
                        {formatConfidence(proposal.confidence)}
                      </FloraBadge>
                      <FloraBadge accent="lavender" size="sm">
                        {statusLabel(proposal.status)}
                      </FloraBadge>
                      {proposal.rank === 1 ? (
                        <FloraBadge accent="sage" size="sm">
                          Meilleure proposition
                        </FloraBadge>
                      ) : null}
                      {isSelected ? (
                        <FloraBadge accent="sage" size="sm">
                          Sélectionnée
                        </FloraBadge>
                      ) : null}
                    </div>
                    <p className="text-sm leading-snug text-flora-text">{proposal.competenceText}</p>
                    <p className="mt-1 text-xs font-light text-flora-text-subtle">
                      {[proposal.hierarchy.sousMatiere, proposal.hierarchy.niveau]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-2 text-xs font-light text-flora-text-subtle underline-offset-2 hover:underline"
                  onClick={() =>
                    setExpandedProposalId(isExpanded ? null : proposal.referentielId)
                  }
                >
                  {isExpanded ? "Masquer l'explication" : "Voir l'explication"}
                </button>

                {isExpanded ? (
                  <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-xs font-light leading-relaxed text-flora-text-subtle">
                    {proposal.explanation}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <FloraButton accent="sage" size="sm" onClick={() => void handleAccept(proposal)}>
                    Valider
                  </FloraButton>
                  {onModify ? (
                    <FloraButton
                      accent="lavender"
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleModify(proposal)}
                    >
                      Modifier
                    </FloraButton>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function buildTheaSeanceAssociationContent(input: {
  structured: {
    title?: string;
    competenceBo?: string;
    objectif?: string;
    materiel?: string[];
    methode?: string;
    phases?: Array<{ summary?: string; activities?: Array<{ objectif?: string; consignesEnseignant?: string }> }>;
  };
  matiere: string;
  niveau?: string;
}): PedagogicalContentInput {
  return buildAssociationInputFromSeanceDraft({
    draft: {
      title: input.structured.title,
      matiere: input.matiere,
      niveau: input.niveau,
      competenceBo: input.structured.competenceBo,
      objectif: input.structured.objectif,
      methode: input.structured.methode,
      phases: input.structured.phases,
    },
  });
}

export function buildTheaSequenceAssociationContent(input: {
  structured: {
    title?: string;
    competenceBo?: string;
    objectifs?: string[];
    notions?: string[];
    materiel?: string[];
    methode?: string;
  };
  matiere: string;
  niveau?: string;
}): PedagogicalContentInput {
  return buildAssociationInputFromSequenceDraft({
    draft: {
      title: input.structured.title,
      matiere: input.matiere,
      niveau: input.niveau,
      competenceBo: input.structured.competenceBo,
      objectifs: input.structured.objectifs,
      notions: input.structured.notions,
      materiel: input.structured.materiel,
      methode: input.structured.methode,
    },
  });
}
