"use client";

import { FloraCard } from "@/components/ui/FloraCard";
import type { TimetableHistoryEntry } from "@/lib/timetable/types";
import { colors } from "@/lib/theme";

const ACTION_LABELS: Record<string, string> = {
  create: "Création",
  generate: "Génération automatique",
  move_slot: "Déplacement",
  lock: "Verrouillage",
  unlock: "Déverrouillage",
  update_settings: "Paramètres modifiés",
  create_version: "Version sauvegardée",
  restore_version: "Version restaurée",
};

type TimetableHistoryPanelProps = {
  history: TimetableHistoryEntry[];
  isLoading: boolean;
};

export function TimetableHistoryPanel({ history, isLoading }: TimetableHistoryPanelProps) {
  return (
    <FloraCard padding="lg" accent="peach">
      <h3 className="font-serif text-xl font-medium" style={{ color: colors.charcoal.DEFAULT }}>
        Historique
      </h3>

      {isLoading ? (
        <p className="mt-4 text-sm font-light text-flora-text-subtle">Chargement…</p>
      ) : history.length === 0 ? (
        <p className="mt-4 text-sm font-light text-flora-text-subtle">Aucune action enregistrée.</p>
      ) : (
        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
          {history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-white/50 bg-white/35 px-3 py-2 text-xs"
            >
              <p className="font-medium text-flora-text">
                {ACTION_LABELS[entry.action] ?? entry.action}
              </p>
              <p className="font-light text-flora-text-subtle">
                {new Date(entry.created_at).toLocaleString("fr-FR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </FloraCard>
  );
}
