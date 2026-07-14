"use client";

import { useCallback, useRef, useState } from "react";
import { FloraCard } from "@/components/ui/FloraCard";
import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import { SCHOOL_DAYS } from "@/lib/timetable/types";
import {
  ExportService,
  DEFAULT_PRINT_CUSTOMIZATION,
  type ExportFormat,
  type PrintCustomization,
  type SchedulePrintMeta,
  resolvePageDimensions,
} from "@/lib/timetable/export";
import { SchedulePrintLayout } from "./SchedulePrintLayout";
import { PrintToolbar } from "./PrintToolbar";

type PrintPreviewProps = {
  slots: SmartTimetableSlot[];
  settings: TimetableSettings;
  meta: SchedulePrintMeta;
  onClose: () => void;
};

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 0.6;

export function PrintPreview({ slots, settings, meta, onClose }: PrintPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [customization, setCustomization] = useState<PrintCustomization>(DEFAULT_PRINT_CUSTOMIZATION);
  const [zoom, setZoom] = useState(0.26);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolDays = settings.schoolDays.length > 0 ? settings.schoolDays : [...SCHOOL_DAYS];
  const dimensions = resolvePageDimensions(customization);

  const handleCustomizationChange = useCallback((patch: Partial<PrintCustomization>) => {
    setCustomization((current) => ({ ...current, ...patch }));
  }, []);

  const fitToPage = useCallback(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const availableWidth = container.clientWidth - 32;
    const availableHeight = container.clientHeight - 32;
    const scaleW = availableWidth / dimensions.width;
    const scaleH = availableHeight / dimensions.height;
    setZoom(Math.min(Math.max(Math.min(scaleW, scaleH), MIN_ZOOM), MAX_ZOOM));
  }, [dimensions.width, dimensions.height]);

  const runExport = useCallback(
    async (format: ExportFormat) => {
      const node = printRef.current;
      if (!node) return;

      setIsExporting(true);
      setError(null);

      try {
        await ExportService.export(node, format, {
          orientation: customization.orientation,
          pageFormat: customization.pageFormat,
        });
        if (format === "print") onClose();
      } catch (exportError) {
        setError(exportError instanceof Error ? exportError.message : "Export impossible.");
      } finally {
        setIsExporting(false);
      }
    },
    [customization.orientation, customization.pageFormat, onClose],
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" accent="sage" className="relative my-4 w-full max-w-7xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-flora-text-subtle hover:text-flora-text"
          aria-label="Fermer"
        >
          ✕
        </button>

        <h2 className="font-serif text-2xl font-medium text-flora-text">Export Premium</h2>
        <p className="mt-1 text-sm font-light text-flora-text-muted">
          Aperçu fidèle au rendu imprimé — police 30 px, mise en page classe.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <PrintToolbar
            customization={customization}
            onChange={handleCustomizationChange}
            onExport={runExport}
            isExporting={isExporting}
            error={error}
          />

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 0.04))}
                className="rounded-full bg-white/60 px-3 py-1.5 text-sm text-flora-text hover:bg-white/80"
                aria-label="Zoom arrière"
              >
                −
              </button>
              <span className="min-w-[4rem] text-center text-xs text-flora-text-muted">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 0.04))}
                className="rounded-full bg-white/60 px-3 py-1.5 text-sm text-flora-text hover:bg-white/80"
                aria-label="Zoom avant"
              >
                +
              </button>
              <button
                type="button"
                onClick={fitToPage}
                className="rounded-full bg-white/60 px-3 py-1.5 text-xs text-flora-text hover:bg-white/80"
              >
                Adapter à la page
              </button>
            </div>

            <div
              ref={previewContainerRef}
              className="overflow-auto rounded-3xl border border-white/60 bg-[#eceae6] p-4"
              style={{ minHeight: 480, maxHeight: "70vh" }}
            >
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  width: dimensions.width * zoom,
                  minHeight: dimensions.height * zoom,
                }}
              >
                <SchedulePrintLayout
                  slots={slots}
                  schoolDays={schoolDays}
                  meta={meta}
                  customization={customization}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none fixed left-[-99999px] top-0 opacity-0"
        >
          <SchedulePrintLayout
            ref={printRef}
            slots={slots}
            schoolDays={schoolDays}
            meta={meta}
            customization={customization}
          />
        </div>
      </FloraCard>
    </div>
  );
}
