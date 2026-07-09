"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import type { AgendaView } from "@/lib/agenda/types";
import { addDaysToIso, todayIso, tomorrowIso, startOfWeek, endOfWeek } from "@/lib/agenda/date-utils";

type AgendaNavigationProps = {
  view: AgendaView;
  focusDate: string;
  onViewChange: (view: AgendaView) => void;
  onDateChange: (date: string) => void;
};

export function AgendaNavigation({
  view,
  focusDate,
  onViewChange,
  onDateChange,
}: AgendaNavigationProps) {
  const views: Array<{ id: AgendaView; label: string }> = [
    { id: "ma_journee", label: "Ma journée" },
    { id: "day", label: "Jour" },
    { id: "week", label: "Semaine" },
    { id: "month", label: "Mois" },
    { id: "list", label: "Liste" },
    { id: "tasks", label: "Tâches" },
    { id: "108h", label: "108h" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {views.map((item) => (
          <FloraButton
            key={item.id}
            size="sm"
            variant={view === item.id ? "primary" : "secondary"}
            accent={view === item.id ? "sage" : "lavender"}
            onClick={() => onViewChange(item.id)}
          >
            {item.label}
          </FloraButton>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FloraButton size="sm" variant="secondary" onClick={() => onDateChange(todayIso())}>
          Aujourd&apos;hui
        </FloraButton>
        <FloraButton size="sm" variant="secondary" onClick={() => onDateChange(tomorrowIso())}>
          Demain
        </FloraButton>
        <FloraButton
          size="sm"
          variant="secondary"
          onClick={() => onDateChange(startOfWeek(todayIso()))}
        >
          Cette semaine
        </FloraButton>
        <FloraButton
          size="sm"
          variant="secondary"
          onClick={() => onDateChange(startOfWeek(addDaysToIso(todayIso(), 7)))}
        >
          Semaine suivante
        </FloraButton>
        <input
          type="date"
          value={focusDate}
          onChange={(event) => onDateChange(event.target.value)}
          className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-light outline-none focus:border-sauge/40"
        />
        <span className="text-xs font-light text-flora-text-subtle">
          Semaine du {startOfWeek(focusDate)} au {endOfWeek(focusDate)}
        </span>
      </div>
    </div>
  );
}
