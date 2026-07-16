"use client";

import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolveSlotCardDisplay } from "@/lib/timetable/slot-display";
import { ScheduleCardView } from "@/lib/timetable/schedule-card/ScheduleCardView";
import { useFloraTheme } from "@/components/theme/ThemeProvider";

type TimetableSlotCardProps = {
  slot: SmartTimetableSlot;
  onEdit?: () => void;
  onLock?: () => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
  density?: "grid" | "compact";
  fillHeight?: boolean;
  heightPx?: number;
  overlapping?: boolean;
};

export function TimetableSlotCard({
  slot,
  onEdit,
  onLock,
  draggable = false,
  onDragStart,
  density = "compact",
  fillHeight = false,
  heightPx,
  overlapping = false,
}: TimetableSlotCardProps) {
  const { themeId } = useFloraTheme();
  const display = resolveSlotCardDisplay(slot);
  const locked = slot.lockLevel !== "none";
  const isGrid = density === "grid";

  return (
    <article
      draggable={draggable && !locked}
      onDragStart={onDragStart}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (onEdit && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onEdit();
        }
      }}
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
      title={display.tooltip}
      className={`relative ${fillHeight ? "h-full min-h-0" : ""} ${
        isGrid
          ? `transition duration-200 ${
              draggable && !locked ? "cursor-grab active:cursor-grabbing" : onEdit ? "cursor-pointer" : ""
            } ${locked ? "rounded-xl ring-1 ring-amber-200/70" : ""} ${
              overlapping ? "rounded-xl ring-2 ring-rose-400/80" : ""
            }`
          : `${
              draggable && !locked ? "cursor-grab active:cursor-grabbing" : onEdit ? "cursor-pointer" : ""
            } ${locked ? "ring-1 ring-amber-200/70 rounded-[1.25rem]" : ""} ${
              overlapping ? "ring-2 ring-rose-400/80 rounded-[1.25rem]" : ""
            }`
      }`}
    >
      <ScheduleCardView
        slot={slot}
        mode="screen"
        themeId={themeId}
        density={density}
        showRoomAndTeacher={!isGrid}
        fixedHeightPx={heightPx}
        className={`${fillHeight ? "h-full min-h-0" : ""} ${
          isGrid ? "transition duration-200 hover:brightness-[1.02] hover:shadow-[var(--shadow-hover)]" : ""
        }`}
      >
        {onLock ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onLock();
            }}
            className={`absolute z-10 schedule-card-time shrink-0 rounded-md bg-white/40 px-1 py-0.5 opacity-70 transition hover:opacity-100 ${
              isGrid ? "right-1 top-1" : "right-2 top-2"
            }`}
            title="Verrouiller la séance"
          >
            {locked ? "🔒" : "○"}
          </button>
        ) : null}
        {!isGrid && onEdit ? (
          <p className="schedule-card-secondary mt-2 shrink-0 opacity-60 transition group-hover:opacity-90">
            Cliquer pour tout modifier
          </p>
        ) : null}
      </ScheduleCardView>
    </article>
  );
}
