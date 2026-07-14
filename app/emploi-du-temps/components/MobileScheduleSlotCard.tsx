"use client";

import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolveSlotAppearance } from "@/lib/timetable/subject-palette";
import { readSlotMeta } from "@/lib/timetable/slot-editor/operations";
import { defaultIconForSlot } from "@/lib/timetable/slot-editor/constants";
import { isMobileBreakSlot } from "@/lib/timetable/mobile-schedule-utils";
import { useFloraTheme } from "@/components/theme/ThemeProvider";

type Props = {
  slot: SmartTimetableSlot;
  overlapping?: boolean;
  onOpen?: () => void;
};

export function MobileScheduleSlotCard({ slot, overlapping = false, onOpen }: Props) {
  const { themeId } = useFloraTheme();
  const meta = readSlotMeta(slot);
  const isBreak = isMobileBreakSlot(slot);
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
  const displayTitle = meta.displayText?.trim();
  const subjectLine = displayTitle || slot.subject || "Créneau";
  const locked = slot.lockLevel !== "none";
  const showLevels = meta.levels?.length && !isBreak;
  const timeLabel = `${slot.start.replace(":", " h ")} – ${slot.end.replace(":", " h ")}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mobile-schedule-card w-full rounded-2xl border text-left shadow-[var(--shadow-card)] transition active:scale-[0.99] ${
        isBreak ? "min-h-[56px] px-4 py-3" : "min-h-[72px] px-4 py-3.5"
      } ${locked ? "ring-1 ring-amber-200/80" : ""} ${
        overlapping ? "ring-2 ring-rose-400/80" : ""
      }`}
      style={{
        background: appearance.gradient,
        borderColor: overlapping ? "#e8a4a4" : appearance.borderColor,
        color: appearance.textColor,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mobile-schedule-time text-[14px] font-medium leading-snug tracking-wide">
            {timeLabel}
          </p>
          <p className="mobile-schedule-subject mt-1 font-serif text-[17px] font-semibold leading-snug">
            {subjectLine}
          </p>
          {slot.subSubject ? (
            <p className="mobile-schedule-secondary mt-0.5 text-[14px] font-light leading-snug opacity-95">
              {slot.subSubject}
            </p>
          ) : null}
          {showLevels ? (
            <p className="mobile-schedule-secondary mt-0.5 text-[14px] font-light leading-snug opacity-85">
              {meta.levels!.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-base leading-none" aria-hidden>
            {icon}
          </span>
          {locked ? (
            <span className="text-[12px] opacity-80" title="Créneau verrouillé">
              🔒
            </span>
          ) : null}
          {overlapping ? (
            <span className="text-[11px] font-medium text-rose-700/90">Conflit</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
