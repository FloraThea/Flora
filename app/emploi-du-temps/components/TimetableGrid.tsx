"use client";

import { useMemo } from "react";
import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import { SCHOOL_DAYS } from "@/lib/timetable/types";
import { colors } from "@/lib/theme";
import {
  buildScheduleGridModel,
  SLOT_GAP_PX,
  type PositionedSlot,
} from "@/lib/timetable/schedule-grid-layout";
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

  const grid = useMemo(
    () => buildScheduleGridModel(slots, days, settings),
    [slots, days, settings],
  );

  const slotsByDay = useMemo(() => {
    const map = new Map<string, PositionedSlot[]>();
    for (const day of days) map.set(day, []);
    for (const positioned of grid.positioned) {
      const list = map.get(positioned.day);
      if (list) list.push(positioned);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.topPx - b.topPx);
    }
    return map;
  }, [grid.positioned, days]);

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

  const timeColumnWidth = 72;
  const gridTemplateColumns = `${timeColumnWidth}px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[640px] rounded-3xl border border-white/60 bg-white/35 p-3 md:p-4"
        style={{
          display: "grid",
          gridTemplateColumns,
          columnGap: 8,
        }}
      >
        {/* En-têtes */}
        <div className="sticky top-0 z-10 bg-white/50 pb-2 backdrop-blur-sm" />
        {days.map((day) => (
          <div
            key={`head-${day}`}
            className="sticky top-0 z-10 flex items-center justify-between border-b border-white/50 bg-white/50 pb-2 backdrop-blur-sm"
          >
            <h4 className="font-serif text-base font-medium md:text-lg" style={{ color: colors.charcoal.DEFAULT }}>
              {day}
            </h4>
            <button
              type="button"
              onClick={() => onLockDay(day)}
              className="text-[10px] font-light text-flora-text-subtle hover:text-flora-text"
              title="Verrouiller la journée"
            >
              🔒
            </button>
          </div>
        ))}

        {/* Colonne horaires */}
        <div
          className="relative shrink-0 border-r border-white/50 pr-1"
          style={{ height: grid.scale.totalHeightPx }}
        >
          {grid.timeLabels.map((tick) => (
            <div
              key={tick.minutes}
              className="absolute left-0 right-0 border-t border-white/40"
              style={{ top: tick.topPx }}
            >
              <span
                className={`block pr-1 text-right leading-none ${
                  tick.kind === "major"
                    ? "text-[11px] font-semibold text-flora-text"
                    : "text-[9px] font-light text-flora-text-subtle"
                }`}
                style={{ transform: "translateY(-50%)" }}
              >
                {tick.kind === "major" ? tick.label : ""}
              </span>
            </div>
          ))}
        </div>

        {/* Colonnes journées */}
        {days.map((day) => {
          const dayPositions = slotsByDay.get(day) ?? [];
          const isEmpty = dayPositions.length === 0;

          return (
            <div
              key={day}
              className="relative min-w-0"
              style={{ height: grid.scale.totalHeightPx }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, day)}
            >
              {/* Lignes horizontales de référence */}
              {grid.timeLabels
                .filter((tick) => tick.kind === "major")
                .map((tick) => (
                  <div
                    key={`${day}-grid-${tick.minutes}`}
                    className="pointer-events-none absolute inset-x-0 border-t border-white/30"
                    style={{ top: tick.topPx }}
                  />
                ))}

              {isEmpty && onAddDay ? (
                <button
                  type="button"
                  onClick={() => onAddDay(day)}
                  className="absolute inset-x-1 top-4 rounded-2xl border border-dashed border-white/70 bg-white/30 px-3 py-8 text-center text-sm font-light text-flora-text-subtle transition hover:border-white hover:bg-white/50 hover:text-flora-text"
                >
                  + Ajouter une plage
                </button>
              ) : null}

              {dayPositions.map(({ slot, topPx, heightPx }) => (
                <div
                  key={slot.id}
                  className="absolute inset-x-0.5 overflow-hidden"
                  style={{
                    top: topPx,
                    height: heightPx,
                    marginBottom: SLOT_GAP_PX,
                  }}
                >
                  <TimetableSlotCard
                    slot={slot}
                    density="grid"
                    fillHeight
                    draggable={slot.lockLevel === "none"}
                    onDragStart={(event) => handleDragStart(event, slot)}
                    onEdit={onEditSlot ? () => onEditSlot(slot) : undefined}
                    onLock={() => onLockSlot(slot.id, slot.day)}
                  />
                </div>
              ))}

              {onCreateSlot && !isEmpty ? (
                <AddSlotFab day={day} onCreate={() => onCreateSlot(day, lastSlotId(dayPositions))} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function lastSlotId(positions: PositionedSlot[]): string | null {
  if (positions.length === 0) return null;
  const sorted = [...positions].sort((a, b) => a.topPx - b.topPx);
  return sorted[sorted.length - 1]?.slot.id ?? null;
}

function AddSlotFab({ day, onCreate }: { day: string; onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="absolute bottom-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/90 text-lg text-flora-text-subtle shadow-sm transition hover:scale-105 hover:text-flora-text"
      title={`Ajouter une plage — ${day}`}
    >
      +
    </button>
  );
}
