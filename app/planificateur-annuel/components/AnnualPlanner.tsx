"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { FloraCard } from "@/components/ui/FloraCard";
import type { PlannerFilters, PlannerPayload, PlannerWeek } from "@/lib/annual-planner/types";
import { AnnualProgress } from "./AnnualProgress";
import { PlannerDragDrop } from "./PlannerDragDrop";
import { PlannerExport } from "./PlannerExport";
import { PlannerFiltersPanel } from "./PlannerFilters";
import { PlannerSidebar } from "./PlannerSidebar";
import { PlannerStats } from "./PlannerStats";
import { PlannerToolbar } from "./PlannerToolbar";
import { Timeline } from "./Timeline";

type AnnualPlannerProps = {
  initialPayload: PlannerPayload;
};

function monthKey(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function AnnualPlanner({ initialPayload }: AnnualPlannerProps) {
  return (
    <Suspense fallback={<p className="text-sm font-light text-flora-text-subtle">Chargement…</p>}>
      <AnnualPlannerContent initialPayload={initialPayload} />
    </Suspense>
  );
}

function AnnualPlannerContent({ initialPayload }: AnnualPlannerProps) {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState(initialPayload);
  const [filters, setFilters] = useState<PlannerFilters>(() => {
    const period = Number(searchParams.get("period"));
    if (period) return { view: "period", periodNumber: period };
    return { view: "annual" };
  });
  const [selectedWeek, setSelectedWeek] = useState<PlannerWeek | null>(null);
  const [draggedWeek, setDraggedWeek] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isMoving, setIsMoving] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const periods = useMemo(
    () => payload.calendar.periods.map((period) => ({ number: period.periodNumber, label: period.label })),
    [payload.calendar.periods],
  );

  const months = useMemo(
    () => [...new Set(payload.weeks.map((week) => monthKey(week.startDate)))],
    [payload.weeks],
  );

  const filteredWeeks = useMemo(() => {
    let weeks = payload.weeks;

    if (filters.view === "period" && filters.periodNumber) {
      weeks = weeks.filter((week) => week.periodNumber === filters.periodNumber);
    }

    if (filters.view === "month" && filters.month) {
      weeks = weeks.filter((week) => monthKey(week.startDate) === filters.month);
    }

    return weeks;
  }, [filters.month, filters.periodNumber, filters.view, payload.weeks]);

  const handleMoveWeek = useCallback(
    async (fromWeekNumberInYear: number, toWeekNumberInYear: number) => {
      if (fromWeekNumberInYear === toWeekNumberInYear) return;

      setIsMoving(true);
      setError(null);

      try {
        const response = await fetch("/api/planificateur-annuel/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromWeekNumberInYear, toWeekNumberInYear }),
        });

        const data = (await response.json()) as {
          payload?: PlannerPayload;
          error?: string;
          message?: string;
        };

        if (!response.ok) throw new Error(data.error || "Déplacement impossible.");

        if (data.payload) setPayload(data.payload);
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : "Déplacement impossible.");
      } finally {
        setIsMoving(false);
        setDraggedWeek(null);
      }
    },
    [],
  );

  const showSpecialView = filters.view === "competencies" || filters.view === "hours";

  return (
    <div>
      <FloraPageTitle
        title="Planificateur annuel"
        subtitle={`${payload.profile.levels.join(" · ") || "Ma classe"} — ${payload.profile.schoolYear} · Zone ${payload.profile.zone}`}
      />

      {error ? (
        <FloraCard padding="md" accent="rose" className="mb-4">
          <p className="text-sm font-light text-[#b88989]">{error}</p>
        </FloraCard>
      ) : null}

      <PlannerStats stats={payload.stats} />

      <Timeline markers={payload.timeline} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[260px_1fr_280px]">
        <FloraCard padding="md" accent="sage" className="h-fit">
          <PlannerFiltersPanel
            filters={filters}
            onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
            periods={periods}
            months={months}
          />
        </FloraCard>

        <div className="min-w-0">
          <PlannerToolbar
            zoom={zoom}
            onZoomIn={() => setZoom((value) => Math.min(1.4, value + 0.1))}
            onZoomOut={() => setZoom((value) => Math.max(0.6, value - 0.1))}
            onFitPage={() => setZoom(1)}
            onExport={() => setExportOpen(true)}
            isMoving={isMoving}
          />

          {showSpecialView ? (
            <div className="mt-4">
              <AnnualProgress
                view={filters.view}
                annualProgressPercent={payload.stats.annualProgressPercent}
                competences={payload.competences}
                subjectHours={payload.subjectHours}
              />
            </div>
          ) : (
            <div
              ref={exportRef}
              className="mt-4 origin-top transition-transform"
              style={{ transform: `scale(${zoom})` }}
            >
              <PlannerDragDrop
                weeks={filteredWeeks}
                selectedWeekId={selectedWeek?.id}
                view={filters.view}
                subjectFilter={filters.subject}
                vacationBlocks={payload.vacations}
                compact={filters.view === "annual"}
                draggedWeek={draggedWeek}
                onDragWeek={setDraggedWeek}
                onSelectWeek={setSelectedWeek}
                onMoveWeek={(from, to) => {
                  void handleMoveWeek(from, to);
                }}
              />
            </div>
          )}

          {payload.alerts.length > 0 ? (
            <FloraCard padding="md" accent="rose" className="mt-4">
              <h4 className="font-serif text-lg font-medium">Alertes intelligentes</h4>
              <ul className="mt-2 space-y-1 text-sm font-light text-[#b88989]">
                {payload.alerts.slice(0, 5).map((alert) => (
                  <li key={alert.id}>{alert.message}</li>
                ))}
              </ul>
            </FloraCard>
          ) : null}
        </div>

        <PlannerSidebar selectedWeek={selectedWeek} suggestions={payload.suggestions} />
      </div>

      <PlannerExport open={exportOpen} onClose={() => setExportOpen(false)} exportRootRef={exportRef} />
    </div>
  );
}
