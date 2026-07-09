import { FloraCard } from "@/components/ui/FloraCard";
import type { AgendaEvent } from "@/lib/agenda/types";
import { formatShortDate, formatTime } from "@/lib/agenda/date-utils";
import { AgendaEventCard } from "./AgendaEventCard";

type AgendaDayViewProps = {
  date: string;
  events: AgendaEvent[];
};

export function AgendaDayView({ date, events }: AgendaDayViewProps) {
  const dayEvents = events.filter((event) => event.startAt.slice(0, 10) === date);

  return (
    <FloraCard padding="lg" accent="lavender">
      <h3 className="font-serif text-xl font-medium capitalize">{formatShortDate(date)}</h3>
      <div className="mt-4 space-y-2">
        {dayEvents.length === 0 ? (
          <p className="text-sm font-light text-flora-text-subtle">Aucun événement ce jour.</p>
        ) : (
          dayEvents.map((event) => (
            <div key={event.id}>
              <p className="mb-1 text-xs text-flora-text-subtle">
                {event.allDay ? "Toute la journée" : `${formatTime(event.startAt)} – ${formatTime(event.endAt)}`}
              </p>
              <AgendaEventCard event={event} />
            </div>
          ))
        )}
      </div>
    </FloraCard>
  );
}
