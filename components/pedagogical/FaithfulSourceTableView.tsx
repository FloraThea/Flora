"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import {
  buildFaithfulTableModel,
  isSourceDocumentEmpty,
  type SourceDocument,
} from "@/lib/import/source-document";

export type DocumentViewMode = "faithful" | "structured";

type DocumentViewModeToggleProps = {
  mode: DocumentViewMode;
  hasFaithfulSource: boolean;
  onChange: (mode: DocumentViewMode) => void;
};

export function DocumentViewModeToggle({
  mode,
  hasFaithfulSource,
  onChange,
}: DocumentViewModeToggleProps) {
  if (!hasFaithfulSource) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <FloraButton
        size="sm"
        variant={mode === "faithful" ? "primary" : "secondary"}
        onClick={() => onChange("faithful")}
      >
        Vue fidèle au fichier
      </FloraButton>
      <FloraButton
        size="sm"
        variant={mode === "structured" ? "primary" : "secondary"}
        onClick={() => onChange("structured")}
      >
        Vue structurée Flora
      </FloraButton>
    </div>
  );
}

export function resolveDefaultDocumentViewMode(input: {
  sourceDocument?: SourceDocument | null;
  sourceType?: string;
}): DocumentViewMode {
  if (input.sourceType === "imported" && input.sourceDocument && !isSourceDocumentEmpty(input.sourceDocument)) {
    return "faithful";
  }
  return "structured";
}

type FaithfulSourceTableViewProps = {
  sourceDocument: SourceDocument;
  entityType: "programmation" | "progression";
  entityId: string;
  editable?: boolean;
  onDocumentChange?: (document: SourceDocument) => void;
};

type EditHistoryEntry = {
  sheetIndex: number;
  row: number;
  col: number;
  previousValue: string;
};

export function FaithfulSourceTableView({
  sourceDocument,
  entityType,
  entityId,
  editable = true,
  onDocumentChange,
}: FaithfulSourceTableViewProps) {
  const [document, setDocument] = useState(sourceDocument);
  const [activeSheetIndex, setActiveSheetIndex] = useState(sourceDocument.activeSheetIndex ?? 0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<EditHistoryEntry[]>([]);

  useEffect(() => {
    setDocument(sourceDocument);
    setActiveSheetIndex(sourceDocument.activeSheetIndex ?? 0);
  }, [sourceDocument]);

  const activeSheet = document.sheets[activeSheetIndex];
  const tableModel = useMemo(
    () => (activeSheet ? buildFaithfulTableModel(activeSheet) : []),
    [activeSheet],
  );

  const persistCell = useCallback(
    async (sheetIndex: number, row: number, col: number, displayValue: string, previousValue: string) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const response = await fetch("/api/source-document/cell", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType,
            entityId,
            sheetIndex,
            row,
            col,
            displayValue,
          }),
        });

        const data = (await response.json()) as { sourceDocument?: SourceDocument; error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Impossible d'enregistrer la cellule.");
        }

        if (data.sourceDocument) {
          setDocument(data.sourceDocument);
          onDocumentChange?.(data.sourceDocument);
        }

        setUndoStack((current) => [...current, { sheetIndex, row, col, previousValue }]);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Erreur de sauvegarde.");
      } finally {
        setIsSaving(false);
      }
    },
    [entityId, entityType, onDocumentChange],
  );

  const handleUndo = useCallback(async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;

    const currentValue =
      document.sheets[last.sheetIndex]?.rows[last.row]?.[last.col]?.displayValue ?? "";

    setUndoStack((current) => current.slice(0, -1));
    await persistCell(last.sheetIndex, last.row, last.col, last.previousValue, currentValue);
  }, [document.sheets, persistCell, undoStack]);

  if (!activeSheet) {
    return (
      <p className="text-sm font-light text-flora-text-muted">
        Aucune feuille disponible dans la copie fidèle.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {document.sheets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {document.sheets.map((sheet, index) => (
            <button
              key={`${sheet.name}-${index}`}
              type="button"
              onClick={() => setActiveSheetIndex(index)}
              className={`rounded-2xl px-4 py-2 text-sm font-light transition ${
                activeSheetIndex === index
                  ? "bg-lavender-light/50 text-flora-text"
                  : "bg-white/40 text-flora-text-muted hover:bg-white/70"
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      <div id="faithful-source-table" className="overflow-x-auto rounded-2xl border border-white/60 bg-white/30">
        <table className="min-w-full border-collapse text-sm">
          <tbody>
            {tableModel.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell) => {
                  if (cell.hidden) return null;

                  const style = cell.style;
                  return (
                    <td
                      key={`cell-${rowIndex}-${cell.col}`}
                      rowSpan={cell.rowSpan}
                      colSpan={cell.colSpan}
                      className="border border-white/50 align-top p-2 font-light text-flora-text"
                      style={{
                        backgroundColor: style?.backgroundColor,
                        color: style?.color,
                        fontWeight: style?.fontWeight,
                        fontStyle: style?.fontStyle,
                        textAlign: style?.textAlign,
                        minWidth: "8rem",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {editable ? (
                        <textarea
                          key={`${activeSheetIndex}-${rowIndex}-${cell.col}-${cell.displayValue}`}
                          className="min-h-[2.5rem] w-full resize-y bg-transparent outline-none"
                          defaultValue={cell.displayValue}
                          disabled={isSaving}
                          onBlur={(event) => {
                            const nextValue = event.target.value;
                            if (nextValue === cell.displayValue) return;
                            void persistCell(
                              activeSheetIndex,
                              rowIndex,
                              cell.col,
                              nextValue,
                              cell.displayValue,
                            );
                          }}
                        />
                      ) : (
                        cell.displayValue
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {editable && (
          <FloraButton size="sm" variant="secondary" disabled={undoStack.length === 0 || isSaving} onClick={() => void handleUndo()}>
            Annuler la dernière modification
          </FloraButton>
        )}
        {isSaving ? (
          <span className="text-xs font-light text-flora-text-muted">Enregistrement…</span>
        ) : null}
        {saveError ? <span className="text-xs font-light text-red-700">{saveError}</span> : null}
      </div>

      <p className="text-xs font-light text-flora-text-muted">
        {activeSheet.rowCount} lignes × {activeSheet.colCount} colonnes — feuille « {activeSheet.name} »
      </p>
    </div>
  );
}
