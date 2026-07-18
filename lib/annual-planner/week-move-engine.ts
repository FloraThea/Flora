import { floraDb } from "@/lib/supabase/get-db";
import type { CalendarSnapshot } from "@/lib/programming/types";
import { findCalendarWeek } from "./types";
import type { WeekMoveInput, WeekMoveResult } from "./types";

/**
 * Swaps planning content between two school weeks and cascades updates
 * to progressions, journal entries, and sequences.
 */
export async function swapWeekPlanning(input: {
  calendar: CalendarSnapshot;
  progressionId?: string;
  fromWeekNumberInYear: number;
  toWeekNumberInYear: number;
}): Promise<WeekMoveResult> {
  const fromWeek = findCalendarWeek(input.calendar, input.fromWeekNumberInYear);
  const toWeek = findCalendarWeek(input.calendar, input.toWeekNumberInYear);

  if (!fromWeek || !toWeek) {
    return { ok: false, updatedModules: [], message: "Semaines introuvables dans le calendrier." };
  }

  const fromPeriod = input.calendar.periods.find((period) =>
    period.schoolWeeks.some((week) => week.weekNumberInYear === fromWeek.weekNumberInYear),
  );
  const toPeriod = input.calendar.periods.find((period) =>
    period.schoolWeeks.some((week) => week.weekNumberInYear === toWeek.weekNumberInYear),
  );

  if (!fromPeriod || !toPeriod) {
    return { ok: false, updatedModules: [], message: "Périodes introuvables." };
  }

  const updatedModules: string[] = [];

  if (input.progressionId) {
    await swapProgressionWeeks({
      progressionId: input.progressionId,
      from: { periodNumber: fromPeriod.periodNumber, weekNumber: fromWeek.weekNumberInPeriod },
      to: { periodNumber: toPeriod.periodNumber, weekNumber: toWeek.weekNumberInPeriod },
    });
    updatedModules.push("progressions");
  }

  await swapJournalWeeks({
    from: {
      periodNumber: fromPeriod.periodNumber,
      weekNumber: fromWeek.weekNumberInPeriod,
      startDate: fromWeek.startDate,
      endDate: fromWeek.endDate,
    },
    to: {
      periodNumber: toPeriod.periodNumber,
      weekNumber: toWeek.weekNumberInPeriod,
      startDate: toWeek.startDate,
      endDate: toWeek.endDate,
    },
  });
  updatedModules.push("cahier-journal");

  return {
    ok: true,
    updatedModules,
    message: `Semaines ${input.fromWeekNumberInYear} et ${input.toWeekNumberInYear} permutées.`,
  };
}

async function swapProgressionWeeks(input: {
  progressionId: string;
  from: { periodNumber: number; weekNumber: number };
  to: { periodNumber: number; weekNumber: number };
}) {
  const { data: fromRows } = await (await floraDb())
    .from("progression_rows")
    .select("id")
    .eq("progression_id", input.progressionId)
    .eq("period_number", input.from.periodNumber)
    .eq("week_number", input.from.weekNumber);

  const { data: toRows } = await (await floraDb())
    .from("progression_rows")
    .select("id")
    .eq("progression_id", input.progressionId)
    .eq("period_number", input.to.periodNumber)
    .eq("week_number", input.to.weekNumber);

  const fromIds = (fromRows ?? []).map((row) => row.id);
  const toIds = (toRows ?? []).map((row) => row.id);

  if (fromIds.length === 0 && toIds.length === 0) return;

  const tempWeek = -1;

  if (fromIds.length > 0) {
    await (await floraDb())
      .from("progression_rows")
      .update({ week_number: tempWeek, updated_at: new Date().toISOString() })
      .in("id", fromIds);
  }

  if (toIds.length > 0) {
    await (await floraDb())
      .from("progression_rows")
      .update({
        period_number: input.from.periodNumber,
        week_number: input.from.weekNumber,
        updated_at: new Date().toISOString(),
      })
      .in("id", toIds);
  }

  if (fromIds.length > 0) {
    await (await floraDb())
      .from("progression_rows")
      .update({
        period_number: input.to.periodNumber,
        week_number: input.to.weekNumber,
        updated_at: new Date().toISOString(),
      })
      .in("id", fromIds);
  }
}

async function swapJournalWeeks(input: {
  from: { periodNumber: number; weekNumber: number; startDate: string; endDate: string };
  to: { periodNumber: number; weekNumber: number; startDate: string; endDate: string };
}) {
  const { data: fromEntries } = await (await floraDb())
    .from("journal_entries")
    .select("id, entry_date")
    .gte("entry_date", input.from.startDate)
    .lte("entry_date", input.from.endDate);

  const { data: toEntries } = await (await floraDb())
    .from("journal_entries")
    .select("id, entry_date")
    .gte("entry_date", input.to.startDate)
    .lte("entry_date", input.to.endDate);

  const fromIds = (fromEntries ?? []).map((entry) => entry.id);
  const toIds = (toEntries ?? []).map((entry) => entry.id);

  const dayOffset =
    (new Date(input.to.startDate).getTime() - new Date(input.from.startDate).getTime()) /
    (1000 * 60 * 60 * 24);

  for (const entry of fromEntries ?? []) {
    const newDate = shiftDate(String(entry.entry_date), dayOffset);
    await (await floraDb())
      .from("journal_entries")
      .update({
        entry_date: newDate,
        period_number: input.to.periodNumber,
        week_number: input.to.weekNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
  }

  for (const entry of toEntries ?? []) {
    const newDate = shiftDate(String(entry.entry_date), -dayOffset);
    await (await floraDb())
      .from("journal_entries")
      .update({
        entry_date: newDate,
        period_number: input.from.periodNumber,
        week_number: input.from.weekNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", entry.id);
  }

  void fromIds;
  void toIds;
}

function shiftDate(isoDate: string, dayOffset: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

export function normalizeWeekMove(input: WeekMoveInput): WeekMoveInput {
  return {
    fromWeekNumberInYear: input.fromWeekNumberInYear,
    toWeekNumberInYear: input.toWeekNumberInYear,
  };
}
