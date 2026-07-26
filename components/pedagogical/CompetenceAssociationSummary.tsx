"use client";

import { FloraBadge } from "@/components/ui/FloraBadge";

type CompetenceAssociationProposalSummary = {
  competenceText?: string;
  confidence?: number;
  explanation?: string;
  status?: "high" | "medium" | "low" | string;
  hierarchy?: {
    sousMatiere?: string;
    niveau?: string;
  };
};

export type CompetenceAssociationMetadata = {
  referentielId?: string;
  confidence?: number;
  explanation?: string;
  status?: string;
  contentHash?: string;
  autoAssociated?: boolean;
  proposals?: CompetenceAssociationProposalSummary[];
};

function formatConfidence(value?: number): string | null {
  if (typeof value !== "number") return null;
  return `${Math.round(value * 100)} %`;
}

function statusAccent(status?: string): "sage" | "lavender" | "rose" {
  if (status === "high" || status === "matched") return "sage";
  if (status === "medium" || status === "fuzzy") return "lavender";
  return "rose";
}

type CompetenceAssociationSummaryProps = {
  association?: CompetenceAssociationMetadata | null;
  className?: string;
};

export function CompetenceAssociationSummary({
  association,
  className = "",
}: CompetenceAssociationSummaryProps) {
  if (!association) return null;

  const confidenceLabel = formatConfidence(association.confidence);

  return (
    <section className={`rounded-2xl border border-white/70 bg-white/45 p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="font-serif text-lg text-flora-text">Association BO</h4>
        {confidenceLabel ? (
          <FloraBadge accent={statusAccent(association.status)} size="sm">
            Confiance {confidenceLabel}
          </FloraBadge>
        ) : null}
        {association.autoAssociated ? (
          <FloraBadge accent="lavender" size="sm">
            Auto-générée
          </FloraBadge>
        ) : null}
      </div>

      {association.explanation ? (
        <p className="text-sm font-light leading-relaxed text-flora-text-subtle">
          {association.explanation}
        </p>
      ) : null}

      {association.proposals && association.proposals.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-flora-text-subtle">
            Propositions analysées
          </p>
          {association.proposals.map((proposal, index) => (
            <div
              key={`${proposal.competenceText ?? "proposal"}-${index}`}
              className="rounded-xl bg-white/60 px-3 py-2 text-xs"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {formatConfidence(proposal.confidence) ? (
                  <FloraBadge accent={statusAccent(proposal.status)} size="sm">
                    {formatConfidence(proposal.confidence)}
                  </FloraBadge>
                ) : null}
                {[proposal.hierarchy?.sousMatiere, proposal.hierarchy?.niveau]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <p className="text-sm text-flora-text">{proposal.competenceText}</p>
              {proposal.explanation ? (
                <p className="mt-1 font-light text-flora-text-subtle">{proposal.explanation}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function readCompetenceAssociationMetadata(
  metadata?: Record<string, unknown> | null,
): CompetenceAssociationMetadata | null {
  const raw = metadata?.competenceAssociation;
  if (!raw || typeof raw !== "object") return null;
  return raw as CompetenceAssociationMetadata;
}
