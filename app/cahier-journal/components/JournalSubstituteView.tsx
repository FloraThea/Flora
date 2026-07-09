"use client";

import { FloraCard } from "@/components/ui/FloraCard";
import type { JournalPayload } from "@/lib/journal/types";
import { colors } from "@/lib/theme";

type Props = {
  payload: JournalPayload;
};

export function JournalSubstituteView({ payload }: Props) {
  return (
    <FloraCard padding="lg" accent="peach">
      <h2 className="font-serif text-2xl font-medium">Mode remplaçant</h2>
      <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
        Version simplifiée prête à imprimer : objectifs, déroulé, consignes, matériel et documents.
      </p>

      <div className="mt-6 grid gap-4">
        {payload.entries.map((entry) => (
          <div key={entry.id} className="rounded-2xl border border-white/70 bg-white/50 px-4 py-4">
            <p className="text-sm font-medium">
              {entry.startTime} – {entry.endTime} · {entry.matiere}
            </p>
            <p className="mt-2 text-sm">
              <strong>Objectif :</strong> {entry.objectif || entry.ritualLabel}
            </p>
            <p className="mt-2 text-sm">
              <strong>Organisation :</strong> {entry.organisation || "—"}
            </p>
            <p className="mt-2 text-sm">
              <strong>Matériel :</strong> {entry.materiel.items.join(", ") || "—"}
            </p>
            <p className="mt-2 text-sm">
              <strong>Documents :</strong> {entry.documents.join(", ") || "—"}
            </p>
          </div>
        ))}
      </div>
    </FloraCard>
  );
}
