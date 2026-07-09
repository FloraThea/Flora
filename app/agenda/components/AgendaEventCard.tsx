import { accentClasses } from "@/lib/theme";
import type { AgendaEvent } from "@/lib/agenda/types";
import { formatTime } from "@/lib/agenda/date-utils";
import { cn } from "@/lib/cn";

type AgendaEventCardProps = {
  event: AgendaEvent;
  compact?: boolean;
};

export function AgendaEventCard({ event, compact }: AgendaEventCardProps) {
  const styles = accentClasses[event.color];

  return (
    <article
      className={cn(
        "rounded-2xl border border-white/70 px-3 py-2",
        styles.bg,
        compact ? "text-xs" : "text-sm",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={cn("font-medium", styles.text)}>{event.title}</p>
          {!event.allDay && (
            <p className="mt-0.5 font-light text-flora-text-subtle">
              {formatTime(event.startAt)} – {formatTime(event.endAt)}
            </p>
          )}
          {event.location ? (
            <p className="mt-1 font-light text-flora-text-subtle">{event.location}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-white/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-flora-text-subtle">
          {event.eventType.replace(/_/g, " ")}
        </span>
      </div>
    </article>
  );
}
