"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { JournalPayload } from "@/lib/journal/types";
import { colors } from "@/lib/theme";

type Props = {
  payload: JournalPayload;
  onExport: (
    variant: "teacher" | "substitute",
    format: "html" | "pdf" | "word",
    scope: "day" | "week" | "period",
  ) => Promise<void>;
};

export function JournalPrintView({ payload, onExport }: Props) {
  return (
    <FloraCard padding="lg" accent="sage">
      <h2 className="font-serif text-2xl font-medium">Impression et exports</h2>
      <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
        Exportez le cahier journal au format jour, semaine ou période. Le PDF utilise l&apos;impression
        navigateur optimisée.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <p className="mb-2 text-xs font-light uppercase tracking-wide text-flora-text-subtle">Jour</p>
          <div className="flex flex-wrap gap-3">
            <FloraButton accent="sage" onClick={() => onExport("teacher", "html", "day")}>
              HTML enseignant
            </FloraButton>
            <FloraButton
              accent="lavender"
              variant="secondary"
              onClick={() => onExport("teacher", "pdf", "day")}
            >
              PDF (impression)
            </FloraButton>
            <FloraButton
              accent="cream"
              variant="secondary"
              onClick={() => onExport("substitute", "html", "day")}
            >
              Version remplaçant
            </FloraButton>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-light uppercase tracking-wide text-flora-text-subtle">Semaine</p>
          <div className="flex flex-wrap gap-3">
            <FloraButton accent="sage" onClick={() => onExport("teacher", "html", "week")}>
              Export semaine
            </FloraButton>
            <FloraButton
              accent="lavender"
              variant="secondary"
              onClick={() => onExport("teacher", "pdf", "week")}
            >
              PDF semaine
            </FloraButton>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-light uppercase tracking-wide text-flora-text-subtle">Période</p>
          <div className="flex flex-wrap gap-3">
            <FloraButton accent="sage" onClick={() => onExport("teacher", "html", "period")}>
              Export période
            </FloraButton>
            <FloraButton
              accent="lavender"
              variant="secondary"
              onClick={() => onExport("teacher", "pdf", "period")}
            >
              PDF période
            </FloraButton>
          </div>
        </div>
      </div>
    </FloraCard>
  );
}
