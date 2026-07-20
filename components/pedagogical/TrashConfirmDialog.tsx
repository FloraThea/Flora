"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";

type TrashConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TrashConfirmDialog({
  title,
  description,
  confirmLabel = "Placer dans la Corbeille",
  isSubmitting = false,
  error = null,
  onCancel,
  onConfirm,
}: TrashConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <FloraCard
        padding="lg"
        accent="peach"
        className="w-full max-w-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-serif text-2xl font-medium">{title}</h2>
        <p className="mt-3 text-sm font-light text-flora-text-muted">{description}</p>
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <FloraButton accent="cream" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </FloraButton>
          <FloraButton accent="rose" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "En cours…" : confirmLabel}
          </FloraButton>
        </div>
      </FloraCard>
    </div>
  );
}
