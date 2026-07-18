import { floraDb } from "@/lib/supabase/get-db";
import type { TimetableInput } from "@/lib/programming/types";
import { addDays } from "./date-utils";
import { scheduleEngine } from "./ScheduleEngine";
import type { CalendarSnapshot } from "@/lib/programming/types";
import type { JournalAdjustment, JournalEntry } from "./types";

export type ReportResult = {
  applied: boolean;
  message: string;
  newSessionDate?: string;
  seanceId?: string;
};

export class ReportEngine {
  async applyReportAdjustment(input: {
    adjustment: JournalAdjustment;
    entries: JournalEntry[];
    journalDate: string;
    calendar: CalendarSnapshot;
    timetable: TimetableInput;
  }): Promise<ReportResult> {
    if (input.adjustment.adjustmentType !== "report") {
      return { applied: false, message: "Type d'ajustement non géré automatiquement." };
    }

    const entryId = String(input.adjustment.payload.entryId ?? "");
    const seanceId = String(input.adjustment.payload.seanceId ?? "");
    const matiere = String(input.adjustment.payload.matiere ?? "");

    const entry = input.entries.find((item) => item.id === entryId);
    const targetSeanceId = seanceId || entry?.seanceId || "";
    const targetMatiere = matiere || entry?.matiere || "";

    if (!targetSeanceId) {
      return { applied: false, message: "Aucune séance à reporter." };
    }

    const nextDate = this.findNextSlotDate(
      input.journalDate,
      targetMatiere,
      input.calendar,
      input.timetable,
    );

    if (!nextDate) {
      return { applied: false, message: "Aucun créneau disponible pour le report." };
    }

    const { error: seanceError } = await (await floraDb())
      .from("seances")
      .update({
        session_date: nextDate,
        metadata: {
          reportedFrom: input.journalDate,
          reportedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetSeanceId);

    if (seanceError) {
      return { applied: false, message: seanceError.message };
    }

    const progressionRowId = entry?.slotData?.progressionRowId;
    if (typeof progressionRowId === "string" && progressionRowId) {
      const { data: row } = await (await floraDb())
        .from("progression_rows")
        .select("remarques")
        .eq("id", progressionRowId)
        .maybeSingle();

      const remarques = (row?.remarques as string[]) ?? [];
      await (await floraDb())
        .from("progression_rows")
        .update({
          remarques: [
            ...remarques,
            `Séance reportée du ${input.journalDate} au ${nextDate}.`,
          ],
          updated_at: new Date().toISOString(),
        })
        .eq("id", progressionRowId);
    }

    return {
      applied: true,
      message: `Séance reportée au ${nextDate}.`,
      newSessionDate: nextDate,
      seanceId: targetSeanceId,
    };
  }

  private findNextSlotDate(
    fromDate: string,
    matiere: string,
    calendar: CalendarSnapshot,
    timetable: TimetableInput,
  ): string | null {
    for (let offset = 1; offset <= 21; offset += 1) {
      const candidate = addDays(fromDate, offset);
      const resolved = scheduleEngine.resolveDay(calendar, timetable, candidate);

      if (resolved.isHoliday || resolved.isVacation) continue;

      const hasSlot = resolved.slots.some(
        (slot) => slot.subject.toLowerCase() === matiere.toLowerCase(),
      );
      if (!hasSlot) continue;

      return candidate;
    }

    return null;
  }
}

export const reportEngine = new ReportEngine();
