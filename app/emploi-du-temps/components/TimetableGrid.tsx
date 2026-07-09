"use client";

import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import { SCHOOL_DAYS } from "@/lib/timetable/types";
import { colors } from "@/lib/theme";
import { TimetableSlotCard } from "./TimetableSlotCard";

type TimetableGridProps = {
  slots: SmartTimetableSlot[];
  settings: TimetableSettings;
  onMoveSlot: (slotId: string, targetDay: string, targetStart: string, targetEnd: string) => void;
  onLockSlot: (slotId: string, day: string) => void;
  onLockDay: (day: string) => void;
  onEditSlot?: (slot: SmartTimetableSlot) => void;
};

export function TimetableGrid({
  slots,
  settings,
  onMoveSlot,
  onLockSlot,
  onLockDay,
  onEditSlot,
}: TimetableGridProps) {
  const days = settings.schoolDays.length > 0 ? settings.schoolDays : [...SCHOOL_DAYS];

  function handleDragStart(event: React.DragEvent, slot: SmartTimetableSlot) {
    event.dataTransfer.setData("slotId", slot.id);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDrop(event: React.DragEvent, day: string) {
    event.preventDefault();
    const slotId = event.dataTransfer.getData("slotId");
    const slot = slots.find((item) => item.id === slotId);
    if (!slot || slot.day === day) return;
    onMoveSlot(slotId, day, slot.start, slot.end);
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {days.map((day) => {
          const daySlots = slots
            .filter((slot) => slot.day === day)
            .sort((a, b) => a.start.localeCompare(b.start));

          return (
            <div
              key={day}
              className="min-w-[220px] rounded-3xl border border-white/60 bg-white/35 p-3 md:p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, day)}
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-serif text-lg font-medium" style={{ color: colors.charcoal.DEFAULT }}>
                  {day}
                </h4>
                <button
                  type="button"
                  onClick={() => onLockDay(day)}
                  className="text-[10px] font-light text-flora-text-subtle hover:text-flora-text"
                  title="Verrouiller la journée"
                >
                  🔒 Journée
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                {daySlots.length === 0 ? (
                  <p className="py-8 text-center text-xs font-light text-flora-text-subtle">
                    Aucun créneau
                  </p>
                ) : (
                  daySlots.map((slot) => (
                    <TimetableSlotCard
                      key={slot.id}
                      slot={slot}
                      draggable={slot.lockLevel === "none"}
                      onDragStart={(event) => handleDragStart(event, slot)}
                      onEdit={onEditSlot ? () => onEditSlot(slot) : undefined}
                      onLock={() => onLockSlot(slot.id, slot.day)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
