import { floraDb } from "@/lib/supabase/get-db";
import type { JournalDashboard } from "./types";

export async function computeProgressPercents(input: {
  schoolYear: string;
  periodNumber: number;
}): Promise<Pick<JournalDashboard, "periodProgressPercent" | "annualProgressPercent">> {
  const { data: seances, error } = await (await floraDb())
    .from("seances")
    .select("id, period_number, session_date, metadata")
    .eq("status", "validated");

  if (error || !seances?.length) {
    return { periodProgressPercent: 0, annualProgressPercent: 0 };
  }

  const inPeriod = seances.filter((row) => Number(row.period_number) === input.periodNumber);
  const totalPeriod = inPeriod.length || 1;
  const donePeriod = inPeriod.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return metadata?.journalStatus === "realisee";
  }).length;

  const totalAnnual = seances.length || 1;
  const doneAnnual = seances.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return metadata?.journalStatus === "realisee";
  }).length;

  return {
    periodProgressPercent: Math.round((donePeriod / totalPeriod) * 100),
    annualProgressPercent: Math.round((doneAnnual / totalAnnual) * 100),
  };
}
