"use client";

import { deferEffect } from "@/lib/hooks/defer-effect";
import { useEffect, useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import { collectOverlappingSlotIds } from "@/lib/timetable/schedule-grid-layout";
import {
  adjacentMobileDay,
  getMobileScheduleDays,
  getSlotsForDay,
  MOBILE_SCHEDULE_DAY_KEY,
  mobileScheduleContainerClassName,
  resolveInitialMobileDay,
} from "@/lib/timetable/mobile-schedule-utils";
import { MobileScheduleSlotCard } from "./MobileScheduleSlotCard";

type Props = {
  slots: SmartTimetableSlot[];
  settings: TimetableSettings;
  selectedDay?: string | null;
  onSelectedDayChange?: (day: string) => void;
  onEditSlot?: (slot: SmartTimetableSlot) => void;
  onCreateSlot?: (day: string, afterSlotId: string | null) => void;
  onLockDay?: (day: string) => void;
};

const FRENCH_WEEKDAYS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
] as const;

function todayFrenchDayName(): string {
  return FRENCH_WEEKDAYS[new Date().getDay()] ?? "Lundi";
}

export function MobileDailySchedule({
  slots,
  settings,
  selectedDay: selectedDayProp,
  onSelectedDayChange,
  onEditSlot,
  onCreateSlot,
  onLockDay,
}: Props) {
  const days = useMemo(() => getMobileScheduleDays(settings), [settings]);
  const overlappingIds = useMemo(() => collectOverlappingSlotIds(slots), [slots]);

  const [internalDay, setInternalDay] = useState(() => {
    if (typeof window === "undefined") return days[0] ?? "Lundi";
    const stored = window.sessionStorage.getItem(MOBILE_SCHEDULE_DAY_KEY);
    return resolveInitialMobileDay(days, stored, todayFrenchDayName());
  });

  const selectedDay = selectedDayProp && days.includes(selectedDayProp) ? selectedDayProp : internalDay;

  const setSelectedDay = (day: string) => {
    setInternalDay(day);
    onSelectedDayChange?.(day);
  };

  useEffect(() => {
    if (selectedDayProp && days.includes(selectedDayProp) && selectedDayProp !== internalDay) {
      deferEffect(() => setInternalDay(selectedDayProp));
    }
  }, [selectedDayProp, days, internalDay]);

  useEffect(() => {
    window.sessionStorage.setItem(MOBILE_SCHEDULE_DAY_KEY, selectedDay);
  }, [selectedDay]);

  useEffect(() => {
    if (!days.includes(selectedDay)) {
      deferEffect(() => setSelectedDay(days[0] ?? "Lundi"));
    }
  }, [days, selectedDay]);

  const daySlots = useMemo(() => getSlotsForDay(slots, selectedDay), [slots, selectedDay]);
  const lastSlotId = daySlots.length > 0 ? daySlots[daySlots.length - 1]?.id ?? null : null;

  return (
    <div
      className={`${mobileScheduleContainerClassName()} flex flex-col gap-4`}
      style={{
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="sticky top-0 z-20 -mx-1 rounded-2xl bg-white/80 px-1 py-2 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <FloraButton
            accent="cream"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedDay(adjacentMobileDay(days, selectedDay, -1))}
            disabled={selectedDay === days[0]}
          >
            ‹ Jour préc.
          </FloraButton>
          <FloraButton
            accent="cream"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedDay(adjacentMobileDay(days, selectedDay, 1))}
            disabled={selectedDay === days[days.length - 1]}
          >
            Jour suiv. ›
          </FloraButton>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((day) => {
            const active = day === selectedDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--sauge)] text-white shadow-sm"
                    : "bg-white/70 text-flora-text-subtle"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <h3 className="font-serif text-xl font-medium">{selectedDay}</h3>
          <div className="flex gap-2">
            {onLockDay ? (
              <FloraButton accent="cream" variant="secondary" size="sm" onClick={() => onLockDay(selectedDay)}>
                🔒 Journée
              </FloraButton>
            ) : null}
            {onCreateSlot ? (
              <FloraButton
                accent="sage"
                size="sm"
                onClick={() => onCreateSlot(selectedDay, lastSlotId)}
              >
                + Ajouter
              </FloraButton>
            ) : null}
          </div>
        </div>
      </div>

      {daySlots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/70 bg-white/40 px-4 py-10 text-center">
          <p className="font-serif text-lg font-medium">Aucun créneau prévu ce jour.</p>
          <p className="mt-2 text-sm font-light text-flora-text-subtle">
            Ajoutez une plage horaire pour construire votre journée.
          </p>
          {onCreateSlot ? (
            <div className="mt-4">
              <FloraButton accent="sage" onClick={() => onCreateSlot(selectedDay, null)}>
                + Ajouter une plage
              </FloraButton>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {daySlots.map((slot) => (
            <li key={slot.id} className="w-full min-w-0">
              <MobileScheduleSlotCard
                slot={slot}
                overlapping={overlappingIds.has(slot.id)}
                onOpen={onEditSlot ? () => onEditSlot(slot) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
