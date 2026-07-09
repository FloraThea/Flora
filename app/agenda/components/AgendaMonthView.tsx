import { FloraCard } from "@/components/ui/FloraCard";
import type { AgendaEvent } from "@/lib/agenda/types";
import { monthGrid, startOfMonth } from "@/lib/agenda/date-utils";
import { cn } from "@/lib/cn";

type AgendaMonthViewProps = {
  focusDate: string;
  events: AgendaEvent[];
  onSelectDate: (date: string) => void;
};

export function AgendaMonthView({ focusDate, events, onSelectDate }: AgendaMonthViewProps) {
  const monthStart = startOfMonth(focusDate);
  const cells = monthGrid(focusDate);

  return (
    <FloraCard padding="lg" accent="cream">
      <h3 className="font-serif text-xl font-medium capitalize">
        {new Date(`${monthStart}T12:00:00`).toLocaleDateString("fr-FR", {
          month: "long",
          year: "numeric",
        })}
      </h3>
      <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[11px] text-[#b5ada5]">
        {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((date) => {
          const count = events.filter((event) => event.startAt.slice(0, 10) === date).length;
          const inMonth = date.startsWith(monthStart.slice(0, 7));
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={cn(
                "min-h-16 rounded-2xl border border-white/60 p-2 text-left transition hover:bg-white/60",
                inMonth ? "bg-white/40" : "bg-white/20 opacity-60",
              )}
            >
              <span className="text-sm">{Number(date.slice(8, 10))}</span>
              {count > 0 ? (
                <span className="mt-1 block text-[10px] text-sauge">{count} evt.</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </FloraCard>
  );
}
