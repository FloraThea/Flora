"use client";

import { useCallback, useRef, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { ExportService } from "@/lib/timetable/export/ExportService";

type PlannerExportProps = {
  open: boolean;
  onClose: () => void;
  exportRootRef: React.RefObject<HTMLDivElement | null>;
};

export function PlannerExport({ open, onClose, exportRootRef }: PlannerExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runExport = useCallback(
    async (format: "pdf" | "png" | "jpeg") => {
      const node = exportRootRef.current;
      if (!node) return;

      setIsExporting(true);
      setError(null);
      try {
        await ExportService.export(node, format, {
          orientation: "landscape",
          pageFormat: "a4",
        }, "planificateur-annuel-flora");
        onClose();
      } catch (exportError) {
        setError(exportError instanceof Error ? exportError.message : "Export impossible.");
      } finally {
        setIsExporting(false);
      }
    },
    [exportRootRef, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" accent="sage" className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-flora-text-subtle hover:text-flora-text"
          aria-label="Fermer"
        >
          ✕
        </button>
        <h3 className="font-serif text-xl font-medium text-flora-text">Exporter le planificateur</h3>
        <p className="mt-1 text-sm font-light text-flora-text-muted">
          Rendu premium prêt à afficher en classe.
        </p>
        <div className="mt-5 space-y-2">
          <FloraButton
            accent="sage"
            className="w-full justify-center"
            disabled={isExporting}
            onClick={() => void runExport("pdf")}
          >
            Export PDF
          </FloraButton>
          <FloraButton
            accent="cream"
            variant="secondary"
            className="w-full justify-center"
            disabled={isExporting}
            onClick={() => void runExport("png")}
          >
            Export PNG HD
          </FloraButton>
          <FloraButton
            accent="lavender"
            variant="secondary"
            className="w-full justify-center"
            disabled={isExporting}
            onClick={() => void runExport("jpeg")}
          >
            Export JPEG
          </FloraButton>
        </div>
        {error ? <p className="mt-3 text-xs text-[#b88989]">{error}</p> : null}
      </FloraCard>
    </div>
  );
}
