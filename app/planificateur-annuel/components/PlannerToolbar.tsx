"use client";

import { FloraButton } from "@/components/ui/FloraButton";

type PlannerToolbarProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitPage: () => void;
  onExport: () => void;
  isMoving: boolean;
};

export function PlannerToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitPage,
  onExport,
  isMoving,
}: PlannerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onZoomOut}
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
          onClick={onZoomIn}
          className="rounded-full bg-white/60 px-3 py-1.5 text-sm text-flora-text hover:bg-white/80"
          aria-label="Zoom avant"
        >
          +
        </button>
        <button
          type="button"
          onClick={onFitPage}
          className="rounded-full bg-white/60 px-3 py-1.5 text-xs text-flora-text hover:bg-white/80"
        >
          Adapter à l&apos;écran
        </button>
        {isMoving ? (
          <span className="text-xs text-flora-text-muted">Mise à jour en cours…</span>
        ) : null}
      </div>

      <FloraButton accent="sage" variant="secondary" size="sm" onClick={onExport}>
        Exporter
      </FloraButton>
    </div>
  );
}
