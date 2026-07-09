"use client";

import { useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { ProgrammingCellContent } from "@/lib/programming/types";
import { colors } from "@/lib/theme";

type CellDetailModalProps = {
  title: string;
  cell: ProgrammingCellContent;
  onClose: () => void;
  onSave: (cell: ProgrammingCellContent) => void;
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

export function CellDetailModal({
  title,
  cell,
  onClose,
  onSave,
}: CellDetailModalProps) {
  const [draft, setDraft] = useState<ProgrammingCellContent>(cell);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-flora-text/25 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-2xl text-flora-text">{title}</h3>
            <p className="mt-1 text-sm font-light" style={{ color: colors.charcoal.faint }}>
              Modifiez le contenu pédagogique de la cellule.
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

        <div className="grid gap-4">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Contenu / thème
            </span>
            <textarea
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              rows={3}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
            />
          </label>

          {(["competences", "notions", "resources", "guides", "modules"] as const).map((field) => (
            <label key={field} className="block">
              <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
                {field}
              </span>
              <textarea
                value={toLines(draft[field])}
                onChange={(event) =>
                  setDraft({ ...draft, [field]: fromLines(event.target.value) })
                }
                rows={4}
                className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none"
              />
            </label>
          ))}
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
