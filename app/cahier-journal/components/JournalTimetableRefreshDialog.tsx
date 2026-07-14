"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { TimetableRefreshChange } from "@/lib/journal/types";

type Props = {
  preview: {
    message: string;
    changes: TimetableRefreshChange[];
    preservedCount: number;
    updatableCount: number;
  };
  isApplying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function fieldLabel(field: TimetableRefreshChange["field"]): string {
  if (field === "startTime") return "Début";
  if (field === "endTime") return "Fin";
  if (field === "matiere") return "Matière";
  return "Sous-matière";
}

export function JournalTimetableRefreshDialog({ preview, isApplying, onCancel, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <FloraCard
        padding="lg"
        accent="peach"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-serif text-2xl font-medium">Actualiser les horaires depuis l&apos;emploi du temps</h2>
        <p className="mt-2 text-sm font-light text-flora-text-subtle">{preview.message}</p>

        <div className="mt-4 grid gap-2 text-sm">
          <p>
            Créneaux modifiables : <strong>{preview.updatableCount}</strong> · conservés (déjà complétés) :{" "}
            <strong>{preview.preservedCount}</strong>
          </p>
        </div>

        {preview.changes.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {preview.changes.map((change, index) => (
              <li key={`${change.entryId}-${change.field}-${index}`} className="rounded-xl bg-white/50 px-3 py-2">
                <span className="font-medium">{change.matiere}</span> — {fieldLabel(change.field)} :{" "}
                {change.previousValue || "—"} → {change.nextValue || "—"}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <FloraButton accent="cream" variant="secondary" onClick={onCancel} disabled={isApplying}>
            Annuler
          </FloraButton>
          <FloraButton
            accent="sage"
            onClick={onConfirm}
            disabled={isApplying || preview.changes.length === 0}
          >
            {isApplying ? "Actualisation…" : "Confirmer l'actualisation"}
          </FloraButton>
        </div>
      </FloraCard>
    </div>
  );
}
