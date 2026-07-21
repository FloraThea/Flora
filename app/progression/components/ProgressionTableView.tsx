"use client";

import { deferEffect } from "@/lib/hooks/defer-effect";
import { useEffect, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import { accentClasses } from "@/lib/theme";
import type { ProgressionRow, ProgressionTab } from "@/lib/progression/types";
import { ProgressionRowModal } from "./ProgressionRowModal";

type ProgressionTableViewProps = {
  tab: ProgressionTab;
  highlightRowId?: string | null;
  onRowChange: (rowId: string, row: ProgressionRow) => void;
  onRowsReorder: (rows: ProgressionRow[]) => void;
};

const COLUMNS = [
  "Période",
  "Semaine",
  "Séquence / Module",
  "Séance",
  "Compétence BO",
  "Objectifs",
  "Déroulement",
  "Matériel",
  "Ressources",
  "Remarques",
] as const;

export function ProgressionTableView({
  tab,
  highlightRowId,
  onRowChange,
  onRowsReorder,
}: ProgressionTableViewProps) {
  const [selectedRow, setSelectedRow] = useState<ProgressionRow | null>(null);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const accent = accentClasses[tab.accent] ?? accentClasses.lavender;
  const title = tab.subSubjectLabel || tab.subjectLabel;

  useEffect(() => {
    if (!highlightRowId) return;
    deferEffect(() => {
      const row = tab.rows.find((item) => item.id === highlightRowId);
      if (!row) return;
      setSelectedRow(row);
      const element = document.getElementById(`progression-row-${row.id}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [highlightRowId, tab.rows]);

  const filledCount = tab.rows.filter(
    (row) => row.competenceBo || row.deroulement.trim(),
  ).length;
  const progressRate = tab.rows.length
    ? Math.round((filledCount / tab.rows.length) * 100)
    : 0;

  const handleDrop = (targetRowId: string) => {
    if (!dragRowId || dragRowId === targetRowId) return;

    const rows = [...tab.rows];
    const fromIndex = rows.findIndex((row) => row.id === dragRowId);
    const toIndex = rows.findIndex((row) => row.id === targetRowId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, moved);
    onRowsReorder(rows.map((row, index) => ({ ...row, sortOrder: index })));
    setDragRowId(null);
  };

  return (
    <>
      <FloraCard padding="lg" className={accent.border}>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h3 className="font-serif text-2xl text-flora-text">{title}</h3>
          <FloraBadge accent={tab.accent}>{tab.subjectLabel}</FloraBadge>
          <FloraBadge accent="sage">{progressRate} % complété</FloraBadge>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/60">
          <div
            className="h-full rounded-full bg-sauge transition-all"
            style={{ width: `${progressRate}%` }}
          />
        </div>

        <div className="flora-table-scroll">
          <table className="min-w-[1200px] w-full border-separate border-spacing-y-2">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    className="px-3 py-2 text-left text-[11px] font-medium tracking-[0.1em] text-flora-text-subtle uppercase"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab.rows.map((row) => (
                <tr
                  key={row.id}
                  id={`progression-row-${row.id}`}
                  draggable
                  onDragStart={() => setDragRowId(row.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(row.id)}
                  onClick={() => setSelectedRow(row)}
                  className={`cursor-pointer rounded-2xl bg-white/65 transition hover:bg-white/85 ${
                    highlightRowId === row.id ? "ring-2 ring-sauge/60" : ""
                  }`}
                >
                  <td className="rounded-l-2xl px-3 py-3 text-sm">P{row.periodNumber}</td>
                  <td className="px-3 py-3 text-sm">S{row.weekNumber}</td>
                  <td className="px-3 py-3 text-sm">{row.sequenceModule}</td>
                  <td className="px-3 py-3 text-sm">{row.seanceLabel}</td>
                  <td className="px-3 py-3 text-sm">{row.competenceBo}</td>
                  <td className="px-3 py-3 text-sm">{row.objectifs.slice(0, 2).join(", ")}</td>
                  <td className="max-w-xs px-3 py-3 text-sm">{row.deroulement.slice(0, 80)}</td>
                  <td className="px-3 py-3 text-sm">{row.materiel.slice(0, 2).join(", ")}</td>
                  <td className="px-3 py-3 text-sm">{row.resources.slice(0, 2).join(", ")}</td>
                  <td className="rounded-r-2xl px-3 py-3 text-sm">{row.remarques || row.commentaires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FloraCard>

      {selectedRow && (
        <ProgressionRowModal
          row={selectedRow}
          title={`${title} — ${selectedRow.seanceLabel}`}
          onClose={() => setSelectedRow(null)}
          onSave={(row) => {
            onRowChange(row.id, row);
            setSelectedRow(null);
          }}
        />
      )}
    </>
  );
}
