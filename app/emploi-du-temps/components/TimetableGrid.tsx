"use client";

import { useState } from "react";
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
  onCreateSlot?: (day: string, afterSlotId: string | null) => void;
  onAddDay?: (day: string) => void;
};

export function TimetableGrid({
  slots,
  settings,
  onMoveSlot,
  onLockSlot,
  onLockDay,
  onEditSlot,
  onCreateSlot,
  onAddDay,
}: TimetableGridProps) {
  const days = settings.schoolDays.length > 0 ? settings.schoolDays : [...SCHOOL_DAYS];
  const [hoverInsert, setHoverInsert] = useState<string | null>(null);

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

  function insertKey(day: string, afterSlotId: string | null) {
    return `${day}:${afterSlotId ?? "start"}`;
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

              <div className="flex flex-col gap-1">
                {onCreateSlot && daySlots.length > 0 ? (
                  <InsertSlotButton
                    visible={hoverInsert === insertKey(day, null)}
                    onMouseEnter={() => setHoverInsert(insertKey(day, null))}
                    onMouseLeave={() => setHoverInsert(null)}
                    onClick={() => onCreateSlot(day, null)}
                  />
                ) : null}

                {daySlots.length === 0 ? (
                  onAddDay ? (
                    <button
                      type="button"
                      onClick={() => onAddDay(day)}
                      className="rounded-2xl border border-dashed border-white/70 bg-white/30 px-4 py-10 text-center text-sm font-light text-flora-text-subtle transition hover:border-white hover:bg-white/50 hover:text-flora-text"
                    >
                      + Ajouter une plage
                      <span className="mt-1 block text-xs opacity-80">
                        Cliquez pour créer le premier créneau
                      </span>
                    </button>
                  ) : (
                    <p className="py-8 text-center text-xs font-light text-flora-text-subtle">
                      Aucun créneau
                    </p>
                  )
                ) : (
                  daySlots.map((slot) => (
                    <div key={slot.id} className="flex flex-col gap-1">
                      <TimetableSlotCard
                        slot={slot}
                        draggable={slot.lockLevel === "none"}
                        onDragStart={(event) => handleDragStart(event, slot)}
                        onEdit={onEditSlot ? () => onEditSlot(slot) : undefined}
                        onLock={() => onLockSlot(slot.id, slot.day)}
                      />
                      {onCreateSlot ? (
                        <InsertSlotButton
                          visible={hoverInsert === insertKey(day, slot.id)}
                          onMouseEnter={() => setHoverInsert(insertKey(day, slot.id))}
                          onMouseLeave={() => setHoverInsert(null)}
                          onClick={() => onCreateSlot(day, slot.id)}
                        />
                      ) : null}
                    </div>
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

function InsertSlotButton({
  visible,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  visible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className="group relative flex h-4 items-center justify-center"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white/80 text-base text-flora-text-subtle shadow-sm transition duration-200 hover:scale-110 hover:bg-white hover:text-flora-text ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0 group-hover:opacity-100"
        }`}
        title="Ajouter une plage ici"
      >
        +
      </button>
    </div>
  );
}
