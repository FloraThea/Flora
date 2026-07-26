"use client";

import { useMemo, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import type { CompetencyMatchResult } from "@/lib/programming/import/types";

type ImportCompetencyMatchPanelProps = {
  matches: CompetencyMatchResult[];
  onChange: (matches: CompetencyMatchResult[]) => void;
};

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)} %`;
}

function statusAccent(status: CompetencyMatchResult["status"]): "sage" | "lavender" | "rose" {
  switch (status) {
    case "matched":
    case "manual":
      return "sage";
    case "fuzzy":
      return "lavender";
    default:
      return "rose";
  }
}

function statusLabel(status: CompetencyMatchResult["status"]): string {
  switch (status) {
    case "matched":
      return "Validée";
    case "manual":
      return "Modifiée";
    case "fuzzy":
      return "Approximative";
    default:
      return "Non retenue";
  }
}

export function ImportCompetencyMatchPanel({ matches, onChange }: ImportCompetencyMatchPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  const visibleMatches = useMemo(
    () =>
      matches.filter(
        (match, index, array) =>
          array.findIndex((item) => item.importedLabel === match.importedLabel) === index,
      ),
    [matches],
  );

  if (visibleMatches.length === 0) return null;

  function updateMatch(importedLabel: string, patch: Partial<CompetencyMatchResult>) {
    onChange(
      matches.map((match) =>
        match.importedLabel === importedLabel ? { ...match, ...patch } : match,
      ),
    );
  }

  function acceptMatch(match: CompetencyMatchResult) {
    updateMatch(match.importedLabel, {
      status: "matched",
      matchedLabel: match.matchedLabel || match.importedLabel,
    });
  }

  function rejectMatch(match: CompetencyMatchResult) {
    updateMatch(match.importedLabel, {
      status: "missing",
      matchedLabel: "",
      referentielId: null,
    });
  }

  function startEditing(match: CompetencyMatchResult) {
    setEditingKey(match.importedLabel);
    setDraftLabel(match.matchedLabel || match.importedLabel);
  }

  function saveEditing(match: CompetencyMatchResult) {
    updateMatch(match.importedLabel, {
      status: "manual",
      matchedLabel: draftLabel.trim(),
    });
    setEditingKey(null);
    setDraftLabel("");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/70 bg-white/45 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-flora-text">Correspondances BO</p>
          <p className="text-xs font-light text-flora-text-subtle">
            Validez ou corrigez les propositions avant l&apos;enregistrement
          </p>
        </div>
        <FloraButton
          accent="sage"
          size="sm"
          variant="secondary"
          onClick={() => {
            onChange(
              matches.map((match) =>
                match.confidence >= 0.75
                  ? { ...match, status: "matched" as const }
                  : match,
              ),
            );
          }}
        >
          Valider les correspondances fortes
        </FloraButton>
      </div>

      <div className="space-y-3">
        {visibleMatches.map((match) => {
          const isExpanded = expandedKey === match.importedLabel;
          const isEditing = editingKey === match.importedLabel;

          return (
            <article
              key={match.importedLabel}
              className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <FloraBadge accent={statusAccent(match.status)} size="sm">
                      {formatConfidence(match.confidence)}
                    </FloraBadge>
                    <FloraBadge accent="lavender" size="sm">
                      {statusLabel(match.status)}
                    </FloraBadge>
                  </div>
                  <p className="text-xs font-light text-flora-text-subtle">
                    Import : {match.importedLabel}
                  </p>
                  {isEditing ? (
                    <input
                      value={draftLabel}
                      onChange={(event) => setDraftLabel(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-sm font-light outline-none"
                    />
                  ) : (
                    <p className="mt-1 text-sm text-flora-text">
                      BO : {match.matchedLabel || "—"}
                    </p>
                  )}
                </div>
              </div>

              {match.explanation ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-light text-flora-text-subtle underline-offset-2 hover:underline"
                  onClick={() =>
                    setExpandedKey(isExpanded ? null : match.importedLabel)
                  }
                >
                  {isExpanded ? "Masquer l'explication" : "Voir l'explication"}
                </button>
              ) : null}

              {isExpanded && match.explanation ? (
                <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-xs font-light leading-relaxed text-flora-text-subtle">
                  {match.explanation}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {isEditing ? (
                  <>
                    <FloraButton accent="sage" size="sm" onClick={() => saveEditing(match)}>
                      Enregistrer
                    </FloraButton>
                    <FloraButton
                      accent="lavender"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingKey(null)}
                    >
                      Annuler
                    </FloraButton>
                  </>
                ) : (
                  <>
                    <FloraButton accent="sage" size="sm" onClick={() => acceptMatch(match)}>
                      Valider
                    </FloraButton>
                    <FloraButton
                      accent="lavender"
                      size="sm"
                      variant="secondary"
                      onClick={() => startEditing(match)}
                    >
                      Modifier
                    </FloraButton>
                    <FloraButton
                      accent="rose"
                      size="sm"
                      variant="secondary"
                      onClick={() => rejectMatch(match)}
                    >
                      Ignorer
                    </FloraButton>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
