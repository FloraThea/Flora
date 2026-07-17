"use client";

import { deferEffect } from "@/lib/hooks/defer-effect";
import { useEffect, useMemo, useState } from "react";
import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import { MobileDailySchedule } from "./MobileDailySchedule";
import { MobileWeeklyScheduleSummary } from "./MobileWeeklyScheduleSummary";

type Props = {
  slots: SmartTimetableSlot[];
  settings: TimetableSettings;
  onLockDay: (day: string) => void;
  onEditSlot?: (slot: SmartTimetableSlot) => void;
  onCreateSlot?: (day: string, afterSlotId: string | null) => void;
};

type MobileViewMode = "day" | "week";

export function MobileScheduleView({ slots, settings, onLockDay, onEditSlot, onCreateSlot }: Props) {
  const [viewMode, setViewMode] = useState<MobileViewMode>("day");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const workingDays = useMemo(
    () => (settings.schoolDays.length > 0 ? settings.schoolDays : undefined),
    [settings.schoolDays],
  );

  useEffect(() => {
    if (viewMode === "day" && !selectedDay && workingDays?.length) {
      deferEffect(() => setSelectedDay(workingDays[0]));
    }
  }, [selectedDay, viewMode, workingDays]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-4 flex gap-2">
        <ViewTab active={viewMode === "day"} label="Jour" onClick={() => setViewMode("day")} />
        <ViewTab active={viewMode === "week"} label="Semaine" onClick={() => setViewMode("week")} />
      </div>

      {viewMode === "week" ? (
        <MobileWeeklyScheduleSummary
          slots={slots}
          settings={settings}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setViewMode("day");
          }}
        />
      ) : (
        <MobileDailySchedule
          slots={slots}
          settings={settings}
          selectedDay={selectedDay}
          onSelectedDayChange={setSelectedDay}
          onEditSlot={onEditSlot}
          onCreateSlot={onCreateSlot}
          onLockDay={onLockDay}
        />
      )}
    </div>
  );
}

function ViewTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-white/80 text-flora-text shadow-sm" : "bg-white/35 text-flora-text-subtle"
      }`}
    >
      {label}
    </button>
  );
}
