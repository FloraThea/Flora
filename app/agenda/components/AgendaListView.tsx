import { FloraCard } from "@/components/ui/FloraCard";
import type { AgendaEvent } from "@/lib/agenda/types";
import { formatShortDate, formatTime } from "@/lib/agenda/date-utils";
import { AgendaEventCard } from "./AgendaEventCard";

type AgendaListViewProps = {
  events: AgendaEvent[];
};

export function AgendaListView({ events }: AgendaListViewProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  return (
    <FloraCard padding="lg" accent="lavender">
      <h3 className="font-serif text-xl font-medium">Liste chronologique</h3>
      <div className="mt-4 space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm font-light text-flora-text-subtle">Aucun événement sur la période.</p>
        ) : (
          sorted.map((event) => (
            <div key={event.id} className="grid gap-2 md:grid-cols-[140px_1fr]">
              <div className="text-sm font-light text-flora-text-subtle">
                <p className="capitalize">{formatShortDate(event.startAt.slice(0, 10))}</p>
                {!event.allDay ? <p>{formatTime(event.startAt)}</p> : null}
              </div>
              <AgendaEventCard event={event} />
            </div>
          ))
        )}
      </div>
    </FloraCard>
  );
}
