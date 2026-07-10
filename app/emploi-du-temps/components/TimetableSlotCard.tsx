"use client";

import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolveSlotAppearance } from "@/lib/timetable/subject-palette";
import { readSlotMeta } from "@/lib/timetable/slot-editor/operations";
import { defaultIconForSlot } from "@/lib/timetable/slot-editor/constants";
import { useFloraTheme } from "@/components/theme/ThemeProvider";

type TimetableSlotCardProps = {
  slot: SmartTimetableSlot;
  onEdit?: () => void;
  onLock?: () => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent) => void;
};

export function TimetableSlotCard({
  slot,
  onEdit,
  onLock,
  draggable = false,
  onDragStart,
}: TimetableSlotCardProps) {
  const { themeId } = useFloraTheme();
  const meta = readSlotMeta(slot);
  const useCustomColor = meta.useCustomColor && slot.color;

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
  const title = meta.displayText?.trim() || slot.subject || "Créneau";
  const showSubjectLine = Boolean(meta.displayText?.trim() && slot.subject !== meta.displayText?.trim());
  const locked = slot.lockLevel !== "none";
  const teacher = meta.teacherName || slot.intervenant;

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
      className={`group relative rounded-[1.25rem] border px-3 py-2.5 text-left shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] ${
        draggable && !locked ? "cursor-grab active:cursor-grabbing" : onEdit ? "cursor-pointer" : ""
      } ${locked ? "ring-1 ring-amber-200/70" : ""}`}
      style={{
        background: appearance.gradient,
        borderColor: appearance.borderColor,
        color: appearance.textColor,
      }}
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="rounded-full bg-white/55 px-2 py-0.5 text-[10px] font-medium tracking-wide">
          {slot.start} – {slot.end}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-sm leading-none" aria-hidden>
            {icon}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onLock?.();
            }}
            className="shrink-0 rounded-lg bg-white/40 px-1.5 py-0.5 text-[10px] opacity-70 transition hover:opacity-100"
            title="Verrouiller la séance"
          >
            {locked ? "🔒" : "○"}
          </button>
        </div>
      </div>

      <h5 className="font-serif text-sm font-medium leading-snug">{title}</h5>

      {showSubjectLine || slot.subSubject ? (
        <p className="mt-0.5 text-xs font-light leading-snug opacity-90">
          {showSubjectLine ? slot.subject : null}
          {showSubjectLine && slot.subSubject ? " · " : null}
          {slot.subSubject}
        </p>
      ) : null}

      {meta.levels?.length ? (
        <p className="mt-1 text-[10px] font-light opacity-75">{meta.levels.join(" · ")}</p>
      ) : null}

      {slot.customText ? (
        <p className="mt-1 line-clamp-2 text-[10px] font-light italic leading-snug opacity-80">
          {slot.customText}
        </p>
      ) : null}

      {(slot.room || teacher) && (
        <div className="mt-1.5 space-y-0.5 text-[10px] font-light opacity-75">
          {slot.room ? <p>{slot.room}</p> : null}
          {teacher ? <p>{teacher}</p> : null}
        </div>
      )}

      {onEdit ? (
        <p className="mt-2 text-[10px] font-light opacity-0 transition group-hover:opacity-70">
          Cliquer pour modifier
        </p>
      ) : null}
    </article>
  );
}
