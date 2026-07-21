"use client";

import { useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import { accentClasses } from "@/lib/theme";
import type {
  ProgrammingCellContent,
  ProgrammingTable,
} from "@/lib/programming/types";
import type { DragCellPayload } from "../types";
import { CellDetailModal } from "./CellDetailModal";

type ProgrammingTableViewProps = {
  table: ProgrammingTable;
  highlightPeriodNumber?: number | null;
  onCellChange: (
    tableKey: string,
    periodNumber: number,
    cell: ProgrammingCellContent,
  ) => void;
};

export function ProgrammingTableView({
  table,
  highlightPeriodNumber,
  onCellChange,
}: ProgrammingTableViewProps) {
  const [selectedCell, setSelectedCell] = useState<{
    periodNumber: number;
    cell: ProgrammingCellContent;
  } | null>(null);
  const [dragPayload, setDragPayload] = useState<DragCellPayload | null>(null);

  const title = table.subSubjectLabel || table.subjectLabel;
  const accent = accentClasses[table.accent] ?? accentClasses.lavender;

  const handleDrop = (targetPeriodNumber: number) => {
    if (!dragPayload || dragPayload.tableKey !== table.subjectKey) return;

    const sourcePeriod = table.periods.find(
      (period) => period.periodNumber === dragPayload.periodNumber,
    );
    const targetPeriod = table.periods.find(
      (period) => period.periodNumber === targetPeriodNumber,
    );

    if (!sourcePeriod || !targetPeriod) return;

    onCellChange(table.subjectKey, dragPayload.periodNumber, targetPeriod.cell);
    onCellChange(table.subjectKey, targetPeriodNumber, dragPayload.cell);
    setDragPayload(null);
  };

  return (
    <>
      <FloraCard padding="lg" className={accent.border} id={`prog-table-${table.subjectKey}`}>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h3 className="font-serif text-2xl text-flora-text">{title}</h3>
          <FloraBadge accent={table.accent}>{table.subjectLabel}</FloraBadge>
        </div>

        <div className="flora-table-scroll">
          <div className="grid min-w-[920px] grid-cols-5 gap-3">
            {table.periods.map((period) => (
              <div key={period.periodNumber} className="flex flex-col gap-2">
                <div
                  id={`prog-period-${period.periodNumber}`}
                  className={`rounded-2xl px-4 py-3 text-center ${accent.bgMuted} ${
                    highlightPeriodNumber === period.periodNumber ? "ring-2 ring-sauge/60" : ""
                  }`}
                >
                  <p className="font-serif text-lg text-flora-text">{period.label}</p>
                  <p className="text-sm font-light text-flora-text-subtle">
                    {period.weekCount} semaine{period.weekCount > 1 ? "s" : ""}
                  </p>
                </div>

                <button
                  type="button"
                  draggable
                  onDragStart={() =>
                    setDragPayload({
                      tableKey: table.subjectKey,
                      periodNumber: period.periodNumber,
                      cell: period.cell,
                    })
                  }
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(period.periodNumber)}
                  onClick={() =>
                    setSelectedCell({
                      periodNumber: period.periodNumber,
                      cell: period.cell,
                    })
                  }
                  className={`min-h-44 rounded-3xl border border-white/70 bg-white/65 p-4 text-left transition hover:bg-white/85 ${accent.border}`}
                >
                  {period.cell.content && (
                    <p className="mb-2 text-sm font-medium text-flora-text">
                      {period.cell.content}
                    </p>
                  )}
                  {period.cell.competences.slice(0, 2).map((item) => (
                    <p key={item} className="text-xs font-light text-flora-text-muted">
                      • {item}
                    </p>
                  ))}
                  {period.cell.notions.slice(0, 2).map((item) => (
                    <p key={item} className="text-xs font-light text-sauge">
                      ◦ {item}
                    </p>
                  ))}
                  {(period.cell.resources.length > 0 || period.cell.guides.length > 0) && (
                    <p className="mt-2 text-[11px] font-light text-flora-text-subtle">
                      {period.cell.resources.length} ressource(s) · {period.cell.guides.length} guide(s)
                    </p>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </FloraCard>

      {selectedCell && (
        <CellDetailModal
          title={`${title} — Période ${selectedCell.periodNumber}`}
          cell={selectedCell.cell}
          onClose={() => setSelectedCell(null)}
          onSave={(cell) => {
            onCellChange(table.subjectKey, selectedCell.periodNumber, cell);
            setSelectedCell(null);
          }}
        />
      )}
    </>
  );
}
