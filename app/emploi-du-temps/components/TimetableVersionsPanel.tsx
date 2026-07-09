"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { TimetableVersion } from "@/lib/timetable/types";
import { VARIANT_LABELS } from "@/lib/timetable/types";
import { colors } from "@/lib/theme";

type TimetableVersionsPanelProps = {
  versions: TimetableVersion[];
  onSaveVersion: () => void;
  onRestore: (versionId: string) => void;
  isLoading: boolean;
};

export function TimetableVersionsPanel({
  versions,
  onSaveVersion,
  onRestore,
  isLoading,
}: TimetableVersionsPanelProps) {
  return (
    <FloraCard padding="lg" accent="lavender">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-serif text-xl font-medium" style={{ color: colors.charcoal.DEFAULT }}>
          Versions
        </h3>
        <FloraButton accent="lavender" variant="secondary" size="sm" onClick={onSaveVersion}>
          Sauvegarder
        </FloraButton>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm font-light text-flora-text-subtle">Chargement…</p>
      ) : versions.length === 0 ? (
        <p className="mt-4 text-sm font-light text-flora-text-subtle">
          Aucune version enregistrée. Sauvegardez avant de tester une variante.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-flora-text">
                  v{version.versionNumber} — {version.label}
                </p>
                <p className="text-xs font-light text-flora-text-subtle">
                  {VARIANT_LABELS[version.variantType]} ·{" "}
                  {new Date(version.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
              <FloraButton
                accent="lavender"
                variant="ghost"
                size="sm"
                onClick={() => onRestore(version.id)}
              >
                Restaurer
              </FloraButton>
            </li>
          ))}
        </ul>
      )}
    </FloraCard>
  );
}
