"use client";

import type { PlannerWeek } from "@/lib/annual-planner/types";
import { WeekCard } from "./WeekCard";
import type { PlannerBadge } from "@/lib/annual-planner/types";
import { PROJECT_BADGE_KINDS } from "@/lib/annual-planner/badge-colors";

type PlannerDragDropProps = {
  weeks: PlannerWeek[];
  selectedWeekId?: string;
  view: string;
  subjectFilter?: string;
  onSelectWeek: (week: PlannerWeek) => void;
  onMoveWeek: (fromWeekNumberInYear: number, toWeekNumberInYear: number) => void;
  draggedWeek?: number | null;
  onDragWeek?: (weekNumberInYear: number | null) => void;
  vacationBlocks?: Array<{ id: string; label: string; startDate: string; endDate: string }>;
  compact?: boolean;
};

function filterBadgesForView(
  view: string,
  subjectFilter?: string,
): ((badge: PlannerBadge) => boolean) | undefined {
  if (view === "project") {
    return (badge) => PROJECT_BADGE_KINDS.includes(badge.kind);
  }
  if (view === "subject" && subjectFilter) {
    const subject = subjectFilter.toLowerCase();
    return (badge) => badge.subjectKey?.toLowerCase().includes(subject) ?? false;
  }
  return undefined;
}

function VacationStrip({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center justify-center rounded-2xl border border-dashed border-peche/40 bg-peche-light/30 px-4 py-3">
      <span className="text-sm font-light text-flora-text-muted">☀️ {label}</span>
    </div>
  );
}

export function PlannerDragDrop({
  weeks,
  selectedWeekId,
  view,
  subjectFilter,
  onSelectWeek,
  onMoveWeek,
  draggedWeek,
  onDragWeek,
  vacationBlocks = [],
  compact,
}: PlannerDragDropProps) {
  const badgeFilter = filterBadgesForView(view, subjectFilter);

  const renderWeeks = weeks.filter((week) => {
    if (view === "subject" && subjectFilter) {
      return week.badges.some((badge) => badgeFilter?.(badge)) || week.sessions.some((session) =>
        session.subjectLabel.toLowerCase().includes(subjectFilter.toLowerCase()),
      );
    }
    if (view === "project") {
      return week.badges.some((badge) => badgeFilter?.(badge));
    }
    return true;
  });

  return (
    <div
      className={
        compact
          ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      }
    >
      {renderWeeks.map((week, index) => {
        const vacation = vacationBlocks.find((block) => {
          const prevWeek = renderWeeks[index - 1];
          if (!prevWeek) return false;
          return block.startDate > prevWeek.endDate && block.startDate <= week.startDate;
        });

        return (
          <div key={week.id} className="contents">
            {vacation ? <VacationStrip label={vacation.label} /> : null}
            <WeekCard
              week={week}
              selected={selectedWeekId === week.id}
              compact={compact}
              filterBadge={badgeFilter}
              onSelect={onSelectWeek}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedWeek && draggedWeek !== week.weekNumberInYear) {
                  onMoveWeek(draggedWeek, week.weekNumberInYear);
                }
                onDragWeek?.(null);
              }}
              onDragStart={(dragWeek) => {
                onDragWeek?.(dragWeek.weekNumberInYear);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
