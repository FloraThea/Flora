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
  /** Mode grille horaire (texte plus grand) vs drawer/preview */
  density?: "grid" | "compact";
  /** Remplit la hauteur du conteneur parent (grille proportionnelle) */
  fillHeight?: boolean;
};

export function TimetableSlotCard({
  slot,
  onEdit,
  onLock,
  draggable = false,
  onDragStart,
  density = "compact",
  fillHeight = false,
}: TimetableSlotCardProps) {
  const { themeId } = useFloraTheme();
  const meta = readSlotMeta(slot);
  const useCustomColor = meta.useCustomColor && slot.color;
  const isGrid = density === "grid";

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

  const titleClass = isGrid
    ? "font-serif text-sm font-bold leading-tight md:text-[15px]"
    : "font-serif text-sm font-medium leading-snug";

  const secondaryClass = isGrid
    ? "text-[11px] font-medium leading-snug opacity-95 md:text-xs"
    : "text-xs font-light leading-snug opacity-90";

  const tertiaryClass = isGrid
    ? "text-[10px] font-light leading-snug opacity-85 md:text-[11px]"
    : "text-[10px] font-light leading-snug opacity-80";

  const timeClass = isGrid
    ? "text-[10px] font-semibold tracking-wide md:text-[11px]"
    : "text-[10px] font-medium tracking-wide";

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
        isGrid ? "px-2 py-1.5 md:px-2.5 md:py-2" : "rounded-[1.25rem] px-3 py-2.5"
      } ${
        isGrid
          ? "hover:brightness-[1.02] hover:shadow-[var(--shadow-hover)]"
          : "hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]"
      } ${
        draggable && !locked ? "cursor-grab active:cursor-grabbing" : onEdit ? "cursor-pointer" : ""
      } ${locked ? "ring-1 ring-amber-200/70" : ""}`}
      style={{
        background: appearance.gradient,
        borderColor: appearance.borderColor,
        color: appearance.textColor,
      }}
    >
      <div className={`flex shrink-0 items-start justify-between gap-1 ${isGrid ? "mb-0.5" : "mb-1.5"}`}>
        <span className={`rounded-full bg-white/55 px-1.5 py-0.5 ${timeClass}`}>{timeLabel}</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className={`leading-none ${isGrid ? "text-xs" : "text-sm"}`} aria-hidden>
            {icon}
          </span>
          {onLock ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onLock();
              }}
              className="shrink-0 rounded-md bg-white/40 px-1 py-0.5 text-[9px] opacity-70 transition hover:opacity-100"
              title="Verrouiller la séance"
            >
              {locked ? "🔒" : "○"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <h5 className={`${titleClass} line-clamp-2`}>{displayTitle || slot.subject || "Créneau"}</h5>

        {subjectLine || slot.subSubject ? (
          <p className={`${secondaryClass} mt-0.5 line-clamp-1`}>
            {subjectLine}
            {subjectLine && slot.subSubject ? " · " : null}
            {slot.subSubject}
          </p>
        ) : null}

        {meta.levels?.length ? (
          <p className={`${tertiaryClass} mt-0.5 line-clamp-1`}>{meta.levels.join(" · ")}</p>
        ) : null}

        {slot.customText ? (
          <p className={`${tertiaryClass} mt-0.5 line-clamp-2 italic`}>{slot.customText}</p>
        ) : null}

        {(slot.room || teacher) && !isGrid ? (
          <div className={`${tertiaryClass} mt-1 space-y-0.5`}>
            {slot.room ? <p className="line-clamp-1">{slot.room}</p> : null}
            {teacher ? <p className="line-clamp-1">{teacher}</p> : null}
          </div>
        ) : null}

        {isGrid && (slot.room || teacher) ? (
          <p className={`${tertiaryClass} mt-0.5 line-clamp-1`}>
            {[slot.room, teacher].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      {onEdit && !isGrid ? (
        <p className="mt-2 shrink-0 text-[10px] font-light opacity-60 transition group-hover:opacity-90">
          Cliquer pour tout modifier
        </p>
      ) : null}
    </article>
  );
}
