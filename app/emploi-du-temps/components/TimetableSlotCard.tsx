"use client";

import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolveSlotAppearance } from "@/lib/timetable/subject-palette";
import { readSlotMeta } from "@/lib/timetable/slot-editor/operations";
import { defaultIconForSlot } from "@/lib/timetable/slot-editor/constants";
import { computeSlotCardTypography } from "@/lib/timetable/slot-card-typography";
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
  const meta = readSlotMeta(slot);
  const useCustomColor = meta.useCustomColor && slot.color;
  const isGrid = density === "grid";
  const typography = isGrid ? computeSlotCardTypography(heightPx ?? 72) : null;

  const appearance = useCustomColor
    ? {
        color: slot.color,
        gradient: slot.gradient || slot.color,
        borderColor: slot.color,
        textColor: "#1a1a1a",
      }
    : resolveSlotAppearance(
        {
          subject: slot.subject,
          subSubject: slot.subSubject,
          slotType: slot.slotType,
          color: slot.color,
          gradient: slot.gradient,
        },
        themeId,
      );

  const icon = meta.icon ?? defaultIconForSlot(slot.subject, slot.subSubject, slot.slotType);
  const displayTitle = meta.displayText?.trim();
  const subjectLine = displayTitle && displayTitle !== slot.subject ? slot.subject : null;
  const locked = slot.lockLevel !== "none";
  const teacher = meta.teacherName || slot.intervenant;
  const timeLabel = `${slot.start} – ${slot.end}`;

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
      title={[timeLabel, displayTitle || slot.subject, slot.subSubject, slot.customText]
        .filter(Boolean)
        .join(" · ")}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left shadow-[var(--shadow-card)] transition duration-200 ${
        fillHeight ? "h-full min-h-0" : ""
      } ${
        isGrid ? "px-2 py-1 md:px-2.5 md:py-1.5" : "rounded-[1.25rem] px-3 py-2.5"
      } ${
        isGrid
          ? "hover:brightness-[1.02] hover:shadow-[var(--shadow-hover)]"
          : "hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]"
      } ${
        draggable && !locked ? "cursor-grab active:cursor-grabbing" : onEdit ? "cursor-pointer" : ""
      } ${locked ? "ring-1 ring-amber-200/70" : ""} ${
        overlapping ? "ring-2 ring-rose-400/80" : ""
      }`}
      style={{
        background: appearance.gradient,
        borderColor: overlapping ? "#e8a4a4" : appearance.borderColor,
        color: appearance.textColor,
      }}
    >
      <div className={`flex shrink-0 items-start justify-between gap-1 ${isGrid ? "mb-0.5" : "mb-1.5"}`}>
        <span
          className={`schedule-card-time rounded-full bg-white/55 px-1.5 py-0.5 tracking-wide ${
            isGrid ? "" : "text-[10px] font-medium"
          }`}
        >
          {timeLabel}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {typography?.showTertiary ? (
            <span className="text-xs leading-none" aria-hidden>
              {icon}
            </span>
          ) : null}
          {onLock ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLock();
              }}
              className="schedule-card-time shrink-0 rounded-md bg-white/40 px-1 py-0.5 opacity-70 transition hover:opacity-100"
              title="Verrouiller la séance"
            >
              {locked ? "🔒" : "○"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <h5
          className={`schedule-card-subject font-serif ${
            isGrid ? "" : "text-sm font-medium leading-snug"
          }`}
          style={{ WebkitLineClamp: typography?.lineClamp ?? 2 }}
        >
          {displayTitle || slot.subject || "Créneau"}
        </h5>

        {typography?.showSecondary && (subjectLine || slot.subSubject) ? (
          <p
            className={`schedule-card-secondary mt-0.5 opacity-95 ${
              isGrid ? "" : "text-xs font-light opacity-90"
            }`}
          >
            {subjectLine}
            {subjectLine && slot.subSubject ? " · " : null}
            {slot.subSubject}
          </p>
        ) : null}

        {typography?.showTertiary && meta.levels?.length ? (
          <p className={`schedule-card-secondary mt-0.5 opacity-85 ${isGrid ? "" : "text-[10px] font-light"}`}>
            {meta.levels.join(" · ")}
          </p>
        ) : null}

        {typography?.showTertiary && slot.customText ? (
          <p
            className={`schedule-card-secondary mt-0.5 italic opacity-85 ${
              isGrid ? "" : "text-[10px] font-light"
            }`}
            style={{ WebkitLineClamp: 2 }}
          >
            {slot.customText}
          </p>
        ) : null}

        {(slot.room || teacher) && !isGrid ? (
          <div className="schedule-card-secondary mt-1 space-y-0.5 font-light opacity-80">
            {slot.room ? <p className="line-clamp-1">{slot.room}</p> : null}
            {teacher ? <p className="line-clamp-1">{teacher}</p> : null}
          </div>
        ) : null}

        {isGrid && typography?.showTertiary && (slot.room || teacher) ? (
          <p className="schedule-card-secondary mt-0.5 line-clamp-1 opacity-85">
            {[slot.room, teacher].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      {onEdit && !isGrid ? (
        <p className="schedule-card-secondary mt-2 shrink-0 opacity-60 transition group-hover:opacity-90">
          Cliquer pour tout modifier
        </p>
      ) : null}
    </article>
  );
}
