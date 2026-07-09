"use client";

import type { PlannerBadge, PlannerWeek } from "@/lib/annual-planner/types";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { cn } from "@/lib/cn";

type WeekCardProps = {
  week: PlannerWeek;
  selected?: boolean;
  compact?: boolean;
  draggable?: boolean;
  onSelect?: (week: PlannerWeek) => void;
  onDragStart?: (week: PlannerWeek) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (week: PlannerWeek) => void;
  filterBadge?: (badge: PlannerBadge) => boolean;
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${startDate.toLocaleDateString("fr-FR", opts)} – ${endDate.toLocaleDateString("fr-FR", opts)}`;
}

export function WeekCard({
  week,
  selected,
  compact,
  draggable = true,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  filterBadge,
}: WeekCardProps) {
  const visibleBadges = filterBadge ? week.badges.filter(filterBadge) : week.badges;

  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", String(week.weekNumberInYear));
        onDragStart?.(week);
      }}
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        onDrop?.(week);
      }}
      onClick={() => onSelect?.(week)}
      className={cn(
        "group relative flex h-full flex-col rounded-3xl border bg-white/70 p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]",
        selected ? "border-sauge/50 ring-2 ring-sauge-light/40" : "border-white/70",
        week.isCurrent && "ring-2 ring-rose-poudre/30",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-flora-text-muted">
            {week.periodLabel}
          </p>
          <h3 className="font-serif text-lg font-medium text-flora-text">
            Semaine {week.weekNumberInYear}
          </h3>
          <p className="text-xs font-light text-flora-text-subtle">
            {formatDateRange(week.startDate, week.endDate)}
          </p>
        </div>
        <FloraBadge accent={week.periodAccent} className="shrink-0">
          {week.classDays} j
        </FloraBadge>
      </div>

      {!compact ? (
        <div className="mb-3 flex flex-wrap gap-1">
          {visibleBadges.slice(0, 6).map((badge) => (
            <FloraBadge key={badge.id} accent={badge.accent} className="text-[10px]">
              {badge.label.length > 22 ? `${badge.label.slice(0, 20)}…` : badge.label}
            </FloraBadge>
          ))}
          {visibleBadges.length > 6 ? (
            <span className="text-[10px] text-flora-text-muted">+{visibleBadges.length - 6}</span>
          ) : null}
        </div>
      ) : null}

      {week.sessions.length > 0 ? (
        <div className="mt-auto flex flex-wrap gap-1 border-t border-white/60 pt-3">
          {week.sessions.slice(0, compact ? 3 : 5).map((session) => (
            <a
              key={session.id}
              href={session.href}
              onClick={(event) => event.stopPropagation()}
              className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-flora-text-muted hover:bg-white"
              title={session.competenceBo || session.label}
            >
              ● {session.label}
            </a>
          ))}
        </div>
      ) : null}

      {week.artwork ? (
        <p className="mt-2 truncate text-[10px] font-light text-flora-text-muted">
          🎨 {week.artwork.title}
        </p>
      ) : null}

      {week.publicHolidays.length > 0 ? (
        <p className="mt-1 text-[10px] text-lavande-text">
          {week.publicHolidays.map((item) => item.label).join(" · ")}
        </p>
      ) : null}
    </article>
  );
}
