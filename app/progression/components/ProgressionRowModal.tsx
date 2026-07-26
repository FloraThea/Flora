"use client";

import { useMemo, useRef, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import {
  CompetenceProposalPanel,
  type CompetenceAssociationSelection,
} from "@/components/pedagogical/CompetenceProposalPanel";
import { buildAssociationInputFromProgressionRow } from "@/lib/pedagogical/competence-association/build-input";
import type { ProgressionRow } from "@/lib/progression/types";

type ProgressionAssociationContext = {
  matiere: string;
  niveau?: string;
  cycle?: string;
  sousMatiere?: string;
  methode?: string;
};

type ProgressionRowModalProps = {
  title: string;
  row: ProgressionRow;
  associationContext?: ProgressionAssociationContext;
  onClose: () => void;
  onSave: (row: ProgressionRow) => void;
};

function toLines(values: string[]): string {
  return values.join("\n");
}

function fromLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProgressionRowModal({
  title,
  row,
  associationContext,
  onClose,
  onSave,
}: ProgressionRowModalProps) {
  const competenceInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ProgressionRow>(row);

  const associationContent = useMemo(
    () =>
      associationContext
        ? buildAssociationInputFromProgressionRow({
            row: draft,
            matiere: associationContext.matiere,
            niveau: associationContext.niveau,
            cycle: associationContext.cycle,
            sousMatiere: associationContext.sousMatiere,
            methode: associationContext.methode,
            entityId: draft.id,
          })
        : null,
    [associationContext, draft],
  );

  function applyAssociationSelection(selection: CompetenceAssociationSelection) {
    setDraft((current) => ({
      ...current,
      competenceBo: selection.competenceBo,
      referentielIds: selection.referentielIds,
      metadata: {
        ...(current.metadata ?? {}),
        competenceAssociation: {
          referentielId: selection.proposal.referentielId,
          confidence: selection.proposal.confidence,
          explanation: selection.proposal.explanation,
          status: selection.proposal.status,
          contentHash: selection.contentHash,
          acceptedAt: new Date().toISOString(),
        },
      },
    }));
  }

  function handleModifySelection(selection: CompetenceAssociationSelection) {
    applyAssociationSelection(selection);
    competenceInputRef.current?.focus();
    competenceInputRef.current?.select();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-flora-text/25 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" className="max-h-[90vh] w-full max-w-4xl overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-2xl text-flora-text">{title}</h3>
            <p className="mt-1 text-sm font-light text-flora-text-subtle">
              Période {draft.periodNumber} · Semaine {draft.weekNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1 text-sm font-light text-flora-text-muted hover:bg-white/60"
          >
            Fermer
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Séquence / Module
            </span>
            <input
              value={draft.sequenceModule}
              onChange={(event) =>
                setDraft({ ...draft, sequenceModule: event.target.value })
              }
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Séance
            </span>
            <input
              value={draft.seanceLabel}
              onChange={(event) =>
                setDraft({ ...draft, seanceLabel: event.target.value })
              }
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Compétence BO
            </span>
            <input
              ref={competenceInputRef}
              value={draft.competenceBo}
              onChange={(event) =>
                setDraft({ ...draft, competenceBo: event.target.value })
              }
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>

          {associationContent ? (
            <div className="lg:col-span-2">
              <CompetenceProposalPanel
                content={associationContent}
                currentCompetence={draft.competenceBo}
                currentReferentielIds={draft.referentielIds}
                onAccept={applyAssociationSelection}
                onModify={handleModifySelection}
              />
            </div>
          ) : null}

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Objectifs
            </span>
            <textarea
              value={toLines(draft.objectifs)}
              onChange={(event) =>
                setDraft({ ...draft, objectifs: fromLines(event.target.value) })
              }
              rows={3}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Déroulement
            </span>
            <textarea
              value={draft.deroulement}
              onChange={(event) =>
                setDraft({ ...draft, deroulement: event.target.value })
              }
              rows={4}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>

          {(["materiel", "resources"] as const).map((field) => (
            <label key={field} className="block">
              <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
                {field === "materiel" ? "Matériel" : "Ressources"}
              </span>
              <textarea
                value={toLines(draft[field])}
                onChange={(event) =>
                  setDraft({ ...draft, [field]: fromLines(event.target.value) })
                }
                rows={3}
                className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
              />
            </label>
          ))}

          <label className="block">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Remarques
            </span>
            <textarea
              value={draft.remarques}
              onChange={(event) =>
                setDraft({ ...draft, remarques: event.target.value })
              }
              rows={3}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Commentaires
            </span>
            <textarea
              value={draft.commentaires}
              onChange={(event) =>
                setDraft({ ...draft, commentaires: event.target.value })
              }
              rows={3}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <FloraButton onClick={() => onSave(draft)}>Enregistrer</FloraButton>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-sm font-light text-flora-text-muted hover:bg-white/60"
          >
            Annuler
          </button>
        </div>
      </FloraCard>
    </div>
  );
}
