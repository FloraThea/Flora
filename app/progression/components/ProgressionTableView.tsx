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

function joinCellParts(values: string[]): string {
  return values.filter(Boolean).join(", ");
}

const cellTextClass =
  "whitespace-pre-wrap break-words align-top text-sm leading-snug text-flora-text";

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
          <table className="min-w-[1400px] w-full border-separate border-spacing-y-2">
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
                  <td className={`rounded-l-2xl px-3 py-3 ${cellTextClass}`}>
                    P{row.periodNumber}
                  </td>
                  <td className={`px-3 py-3 ${cellTextClass}`}>S{row.weekNumber}</td>
                  <td className={`min-w-[10rem] px-3 py-3 ${cellTextClass}`}>
                    {row.sequenceModule}
                  </td>
                  <td className={`min-w-[10rem] px-3 py-3 ${cellTextClass}`}>
                    {row.seanceLabel}
                  </td>
                  <td className={`min-w-[10rem] px-3 py-3 ${cellTextClass}`}>
                    {row.competenceBo}
                  </td>
                  <td className={`min-w-[12rem] px-3 py-3 ${cellTextClass}`}>
                    {joinCellParts(row.objectifs)}
                  </td>
                  <td className={`min-w-[16rem] px-3 py-3 ${cellTextClass}`}>
                    {row.deroulement}
                  </td>
                  <td className={`min-w-[10rem] px-3 py-3 ${cellTextClass}`}>
                    {joinCellParts(row.materiel)}
                  </td>
                  <td className={`min-w-[10rem] px-3 py-3 ${cellTextClass}`}>
                    {joinCellParts(row.resources)}
                  </td>
                  <td className={`rounded-r-2xl min-w-[10rem] px-3 py-3 ${cellTextClass}`}>
                    {row.remarques || row.commentaires}
                  </td>
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
