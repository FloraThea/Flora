"use client";

import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolveSlotAppearance } from "@/lib/timetable/subject-palette";

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
  const appearance = resolveSlotAppearance({
    subject: slot.subject,
    subSubject: slot.subSubject,
    slotType: slot.slotType,
    color: slot.color,
    gradient: slot.gradient,
  });

  const locked = slot.lockLevel !== "none";

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
      className={`group relative rounded-2xl border px-3 py-2.5 text-left shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition hover:shadow-[0_4px_18px_rgba(0,0,0,0.08)] ${
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

      <h5 className="font-serif text-sm font-medium leading-snug">{slot.subject || "Créneau"}</h5>

      {slot.subSubject ? (
        <p className="mt-0.5 text-xs font-light leading-snug opacity-90">{slot.subSubject}</p>
      ) : null}

      {slot.customText ? (
        <p className="mt-1 line-clamp-2 text-[10px] font-light italic leading-snug opacity-80">
          {slot.customText}
        </p>
      ) : null}

      {(slot.room || slot.intervenant) && (
        <div className="mt-1.5 space-y-0.5 text-[10px] font-light opacity-75">
          {slot.room ? <p>{slot.room}</p> : null}
          {slot.intervenant ? <p>{slot.intervenant}</p> : null}
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
