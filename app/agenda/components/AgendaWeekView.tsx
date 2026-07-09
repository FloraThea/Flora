"use client";

import { useState } from "react";
import { FloraCard } from "@/components/ui/FloraCard";
import type { AgendaEvent } from "@/lib/agenda/types";
import { formatShortDate, weekDates } from "@/lib/agenda/date-utils";
import { AgendaEventCard } from "./AgendaEventCard";
import { cn } from "@/lib/cn";

type AgendaWeekViewProps = {
  focusDate: string;
  events: AgendaEvent[];
  onEventMoved?: () => void;
};

export function AgendaWeekView({ focusDate, events, onEventMoved }: AgendaWeekViewProps) {
  const days = weekDates(focusDate);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  async function handleDrop(targetDate: string) {
    if (!draggingId || isMoving) return;

    const event = events.find((item) => item.id === draggingId);
    if (!event || event.startAt.slice(0, 10) === targetDate) {
      setDraggingId(null);
      setDropTarget(null);
      return;
    }

    setIsMoving(true);
    try {
      const response = await fetch("/api/agenda/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          eventId: draggingId,
          targetDate,
        }),
      });
      if (response.ok) onEventMoved?.();
    } finally {
      setIsMoving(false);
      setDraggingId(null);
      setDropTarget(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-7">
      {days.map((date) => {
        const dayEvents = events.filter((event) => event.startAt.slice(0, 10) === date);
        const isTarget = dropTarget === date;

        return (
          <FloraCard
            key={date}
            padding="md"
            accent="cream"
            className={cn(
              "min-h-48 transition-colors",
              isTarget && "ring-2 ring-sauge/60 ring-offset-2",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(date);
            }}
            onDragLeave={() => setDropTarget((current) => (current === date ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              void handleDrop(date);
            }}
          >
            <p className="text-xs font-medium capitalize text-flora-text-subtle">{formatShortDate(date)}</p>
            <div className="mt-2 space-y-2">
              {dayEvents.length === 0 ? (
                <p className="text-[11px] font-light text-[#c5bdb5]">—</p>
              ) : (
                dayEvents.map((event) => (
                  <div
                    key={event.id}
                    draggable={!isMoving}
                    onDragStart={() => setDraggingId(event.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                    className={cn(
                      "cursor-grab active:cursor-grabbing",
                      draggingId === event.id && "opacity-50",
                    )}
                  >
                    <AgendaEventCard event={event} compact />
                  </div>
                ))
              )}
            </div>
          </FloraCard>
        );
      })}
    </div>
  );
}
