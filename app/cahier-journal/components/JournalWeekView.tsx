"use client";

import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import type { JournalDaySummary, JournalPayload, JournalViewMode } from "@/lib/journal/types";
import { formatDateLabel } from "@/lib/journal/date-utils";
import { colors } from "@/lib/theme";

type Props = {
  payload: JournalPayload;
  weekDates: string[];
  mode: JournalViewMode;
  summaries: JournalDaySummary[];
  onSelectDate: (date: string) => void;
};

export function JournalWeekView({
  payload,
  weekDates,
  mode,
  summaries,
  onSelectDate,
}: Props) {
  const title =
    mode === "period"
      ? `Période ${payload.journal.periodNumber}`
      : mode === "calendar"
        ? "Vue calendrier"
        : "Vue semaine";

  const dates = mode === "calendar" ? summaries.map((day) => day.date) : weekDates;

  return (
    <FloraCard padding="lg" accent="cream">
      <h2 className="font-serif text-2xl font-medium">{title}</h2>
      <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
        {mode === "period"
          ? `Période ${payload.journal.periodNumber} — ${summaries.length} jour(s) ouvré(s).`
          : `Semaine scolaire du ${formatDateLabel(weekDates[0] ?? payload.journal.journalDate)}.`}
      </p>

      <div className={`mt-6 grid gap-3 ${mode === "calendar" ? "md:grid-cols-7" : "md:grid-cols-5"}`}>
        {dates.map((date) => {
          const summary = summaries.find((day) => day.date === date);
          const isSelected = date === payload.journal.journalDate;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                isSelected ? "border-sauge bg-sauge-light/20" : "border-white/70 bg-white/45"
              }`}
            >
              <p className="text-sm font-medium">{formatDateLabel(date)}</p>
              {summary ? (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-light text-flora-text-subtle">
                    {summary.entryCount} créneau(x) · {summary.plannedMinutes} min
                  </p>
                  <p className="text-xs font-light text-flora-text-subtle">
                    {summary.completedSessions} séance(s) réalisée(s)
                  </p>
                  {summary.isHoliday ? (
                    <FloraBadge accent="cream" size="sm">
                      Férié / vacances
                    </FloraBadge>
                  ) : null}
                </div>
              ) : (
                <span className="mt-3 inline-block text-xs font-light text-flora-text-subtle">
                  Non généré
                </span>
              )}
              {isSelected ? (
                <FloraBadge accent="sage" size="sm">
                  Journée active
                </FloraBadge>
              ) : null}
            </button>
          );
        })}
      </div>
    </FloraCard>
  );
}
