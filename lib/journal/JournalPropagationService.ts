import { supabase } from "@/lib/supabase";
import { addDays } from "./date-utils";
import { journalGenerator } from "./JournalGenerator";

export class JournalPropagationService {
  async syncFromProgrammation(programmationId: string): Promise<number> {
    const dates = await this.collectAffectedDates(programmationId);
    return this.regenerateDates(dates);
  }

  async syncFromSeance(seanceId: string): Promise<number> {
    const { data: seance } = await supabase
      .from("seances")
      .select("session_date, period_number, week_number, programmation_id")
      .eq("id", seanceId)
      .maybeSingle();

    if (!seance) return 0;

    const dates = new Set<string>();
    if (seance.session_date) dates.add(String(seance.session_date));

    const related = await this.collectAffectedDates(String(seance.programmation_id ?? ""));
    for (const date of related) dates.add(date);

    return this.regenerateDates([...dates]);
  }

  async syncFromTimetableChange(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const end = addDays(today, 28);
    const dates: string[] = [];

    let cursor = today;
    while (cursor <= end) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return this.regenerateDates(dates);
  }

  private async collectAffectedDates(programmationId: string): Promise<string[]> {
    if (!programmationId) return [];

    const { data: seances } = await supabase
      .from("seances")
      .select("session_date")
      .eq("programmation_id", programmationId);

    const dates = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);

    for (const seance of seances ?? []) {
      if (seance.session_date && String(seance.session_date) >= today) {
        dates.add(String(seance.session_date));
      }
    }

    if (dates.size === 0) {
      for (let offset = 0; offset < 14; offset += 1) {
        dates.add(addDays(today, offset));
      }
    }

    return [...dates];
  }

  private async regenerateDates(dates: string[]): Promise<number> {
    let count = 0;

    for (const date of dates) {
      try {
        await journalGenerator.generateForDate({ date, regenerate: true });
        count += 1;
      } catch {
        // Jour non ouvré ou profil incomplet — on continue.
      }
    }

    return count;
  }
}

export const journalPropagationService = new JournalPropagationService();
