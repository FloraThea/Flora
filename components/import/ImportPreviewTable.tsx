"use client";

import type { ImportedProgrammationRow } from "@/lib/programming/import/types";

type ImportPreviewTableProps = {
  rows: ImportedProgrammationRow[];
  fileName?: string;
};

export function ImportPreviewTable({ rows, fileName }: ImportPreviewTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm font-light text-flora-text-muted">
        Aucune ligne structurée détectée dans {fileName ?? "le fichier"}.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/50">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/60 bg-white/40">
            <th className="px-2 py-2 font-medium">Feuille</th>
            <th className="px-2 py-2 font-medium">Ligne</th>
            <th className="px-2 py-2 font-medium">Date</th>
            <th className="px-2 py-2 font-medium">Jour</th>
            <th className="px-2 py-2 font-medium">Période</th>
            <th className="px-2 py-2 font-medium">Semaine</th>
            <th className="px-2 py-2 font-medium">Séquence</th>
            <th className="px-2 py-2 font-medium">Séance</th>
            <th className="px-2 py-2 font-medium">Contenu</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row) => (
            <tr key={row.id} className="border-b border-white/40 last:border-0">
              <td className="px-2 py-2 font-light text-flora-text-muted">{row.sourceSheet ?? "—"}</td>
              <td className="px-2 py-2 font-light text-flora-text-muted">
                {row.sourceRowIndex ?? "—"}
              </td>
              <td className="px-2 py-2">{row.calendarDate ?? "—"}</td>
              <td className="px-2 py-2">{row.dayOfWeek ?? "—"}</td>
              <td className="px-2 py-2">{row.periodNumber ?? "—"}</td>
              <td className="px-2 py-2">{row.weekNumber ?? row.weekLabel ?? "—"}</td>
              <td className="px-2 py-2">{row.sequence || "—"}</td>
              <td className="px-2 py-2">{row.seance || "—"}</td>
              <td className="px-2 py-2 font-light text-flora-text-muted">
                {row.objectif || row.discipline || row.rawLine.slice(0, 80)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 ? (
        <p className="px-3 py-2 text-xs text-flora-text-subtle">
          {rows.length - 50} ligne(s) supplémentaire(s) non affichée(s).
        </p>
      ) : null}
    </div>
  );
}
