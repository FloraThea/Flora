"use client";

import { useMemo } from "react";
import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import {
  buildMobileDaySummaries,
  formatMobileTimeLabel,
  mobileScheduleContainerClassName,
} from "@/lib/timetable/mobile-schedule-utils";

type Props = {
  slots: SmartTimetableSlot[];
  settings: TimetableSettings;
  onSelectDay: (day: string) => void;
};

export function MobileWeeklyScheduleSummary({ slots, settings, onSelectDay }: Props) {
  const summaries = useMemo(() => buildMobileDaySummaries(slots, settings), [slots, settings]);

  return (
    <div
      className={`${mobileScheduleContainerClassName()} grid gap-3`}
      style={{
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {summaries.map((summary) => (
        <button
          key={summary.day}
          type="button"
          onClick={() => onSelectDay(summary.day)}
          className="w-full rounded-2xl border border-white/70 bg-white/55 px-4 py-4 text-left shadow-[var(--shadow-card)] transition active:scale-[0.99]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-serif text-[17px] font-semibold">{summary.day}</p>
              {summary.startTime && summary.endTime ? (
                <p className="mt-1 text-[14px] font-medium text-flora-text-subtle">
                  {formatMobileTimeLabel(summary.startTime)} – {formatMobileTimeLabel(summary.endTime)}
                </p>
              ) : (
                <p className="mt-1 text-[14px] font-light text-flora-text-subtle">Aucun créneau</p>
              )}
            </div>
            <span className="rounded-full bg-white/70 px-3 py-1 text-[14px] font-medium">
              {summary.slotCount} créneau{summary.slotCount > 1 ? "x" : ""}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
