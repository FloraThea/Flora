import type { RitualDefinition } from "@/lib/journal/types";
import type { SchoolLevel } from "@/lib/programming/types";
import { ARTS_PREFERRED_DAYS, EPS_PREFERRED_DAYS, getOfficialWeeklyHours, mergeWeeklyHours, QM_PREFERRED_DAYS } from "./bo-hours";
import { lockManager } from "./LockManager";
import { addMinutes, buildAvailableWindows, hoursFromSlot, sortSlots, type TimeWindow } from "./time-grid";
import { timetableValidator } from "./TimetableValidator";
import type {
  ApcBlock,
  DecloisonnementBlock,
  SmartTimetableSlot,
  TimetableGenerateInput,
  TimetableSettings,
  TimetableVariant,
  TimetableValidationResult,
} from "./types";
import { enrichSlotFields, resolveSlotAppearance } from "./subject-palette";
import { createDefaultTimetableSettings } from "./types";

export type GeneratorContext = {
  scheduleId: string;
  levels: SchoolLevel[];
  schoolYear: string;
  settings: TimetableSettings;
  weeklyHoursTarget: Record<string, number>;
  rituals: RitualDefinition[];
  existingSlots: SmartTimetableSlot[];
  variantType: TimetableVariant;
};

function newSlotId(): string {
  return crypto.randomUUID();
}

type SlotDraft = {
  day: string;
  start: string;
  end: string;
  subject: string;
  subSubject?: string;
  slotType: SmartTimetableSlot["slotType"];
  lockLevel?: SmartTimetableSlot["lockLevel"];
  hours: number;
  room?: string;
  intervenant?: string;
  label?: string;
  metadata?: Record<string, unknown>;
};

function createSlot(
  scheduleId: string,
  partial: SlotDraft,
  sortOrder: number,
): SmartTimetableSlot {
  const appearance = resolveSlotAppearance({
    subject: partial.subject,
    subSubject: partial.subSubject,
    slotType: partial.slotType,
  });

  return enrichSlotFields({
    id: newSlotId(),
    scheduleId,
    sortOrder,
    day: partial.day,
    start: partial.start,
    end: partial.end,
    subject: partial.subject,
    subSubject: partial.subSubject ?? "",
    customText: "",
    color: appearance.color,
    gradient: appearance.gradient,
    slotType: partial.slotType,
    lockLevel: partial.lockLevel ?? "none",
    hours: partial.hours,
    room: partial.room ?? "",
    intervenant: partial.intervenant ?? "",
    label: partial.label ?? "",
    metadata: partial.metadata ?? {},
  });
}

export class TimetableGenerator {
  generate(context: GeneratorContext, input: TimetableGenerateInput): {
    slots: SmartTimetableSlot[];
    validation: TimetableValidationResult;
  } {
    const preserveLocks = input.preserveLocks ?? true;
    const { locked } = lockManager.filterForRegeneration(context.existingSlots, preserveLocks);

    const placed: SmartTimetableSlot[] = [...locked];
    let sortOrder = placed.length;

    sortOrder = this.placeBreaks(context, placed, sortOrder);
    sortOrder = this.placeIntervenants(context, placed, sortOrder);
    sortOrder = this.placeRituals(context, placed, sortOrder);
    sortOrder = this.placeVariantSlots(context, placed, sortOrder);
    sortOrder = this.placeDecloisonnements(context, placed, sortOrder);
    sortOrder = this.placeApcBlocks(context, placed, sortOrder);
    sortOrder = this.placeSubjectSessions(context, placed, sortOrder);

    const slots = sortSlots(placed);
    const validation = timetableValidator.validate(
      slots,
      context.settings,
      context.levels,
      context.weeklyHoursTarget,
    );

    return { slots, validation };
  }

  buildContext(params: {
    scheduleId: string;
    levels: SchoolLevel[];
    schoolYear: string;
    settings?: Partial<TimetableSettings>;
    weeklyHoursFromProgrammations?: Record<string, number>[];
    rituals?: RitualDefinition[];
    existingSlots?: SmartTimetableSlot[];
    variantType?: TimetableVariant;
  }): GeneratorContext {
    const settings: TimetableSettings = {
      ...createDefaultTimetableSettings(),
      ...params.settings,
    };

    const official = getOfficialWeeklyHours(params.levels);
    const weeklyHoursTarget = mergeWeeklyHours(
      official,
      params.weeklyHoursFromProgrammations ?? [],
    );

    return {
      scheduleId: params.scheduleId,
      levels: params.levels,
      schoolYear: params.schoolYear,
      settings,
      weeklyHoursTarget,
      rituals: params.rituals ?? [],
      existingSlots: params.existingSlots ?? [],
      variantType: params.variantType ?? "classique",
    };
  }

  private placeBreaks(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    sortOrder: number,
  ): number {
    for (const day of context.settings.schoolDays) {
      for (const recess of context.settings.recesses) {
        if (this.hasOverlap(placed, day, recess.after, addMinutes(recess.after, recess.durationMinutes))) {
          continue;
        }
        placed.push(
          createSlot(
            context.scheduleId,
            {
              day,
              start: recess.after,
              end: addMinutes(recess.after, recess.durationMinutes),
              subject: recess.label,
              slotType: "recreation",
              hours: recess.durationMinutes / 60,
              lockLevel: "session",
            },
            sortOrder++,
          ),
        );
      }

      const lunch = context.settings.lunchBreak;
      if (!this.hasOverlap(placed, day, lunch.start, lunch.end)) {
        placed.push(
          createSlot(
            context.scheduleId,
            {
              day,
              start: lunch.start,
              end: lunch.end,
              subject: "Pause méridienne",
              slotType: "pause_meridienne",
              hours: 0,
              lockLevel: "session",
            },
            sortOrder++,
          ),
        );
      }
    }

    return sortOrder;
  }

  private placeIntervenants(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    sortOrder: number,
  ): number {
    for (const intervenant of context.settings.intervenants) {
      if (this.hasOverlap(placed, intervenant.day, intervenant.start, intervenant.end)) {
        continue;
      }

      placed.push(
        createSlot(
          context.scheduleId,
          {
            day: intervenant.day,
            start: intervenant.start,
            end: intervenant.end,
            subject: intervenant.subject,
            slotType: "intervenant",
            intervenant: intervenant.name,
            room: intervenant.room ?? "",
            hours: hoursFromSlot({
              start: intervenant.start,
              end: intervenant.end,
              hours: 1,
            }),
            lockLevel: intervenant.locked ? "session" : "none",
          },
          sortOrder++,
        ),
      );
    }

    return sortOrder;
  }

  private placeRituals(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    sortOrder: number,
  ): number {
    const dailyRituals = context.rituals
      .filter((ritual) => ritual.frequency === "daily")
      .sort((a, b) => a.priority - b.priority);

    for (const day of context.settings.schoolDays) {
      let cursor = context.settings.morningStart;

      for (const ritual of dailyRituals) {
        const end = addMinutes(cursor, ritual.dureeMinutes);
        if (this.hasOverlap(placed, day, cursor, end)) {
          cursor = end;
          continue;
        }

        placed.push(
          createSlot(
            context.scheduleId,
            {
              day,
              start: cursor,
              end,
              subject: ritual.matiere ?? "Rituel",
              subSubject: ritual.label,
              slotType: "rituel",
              label: ritual.label,
              hours: ritual.dureeMinutes / 60,
              metadata: { ritualId: ritual.id },
            },
            sortOrder++,
          ),
        );
        cursor = end;
      }
    }

    return sortOrder;
  }

  private placeVariantSlots(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    sortOrder: number,
  ): number {
    if (context.variantType === "piscine") {
      const day = "Mercredi";
      const start = context.settings.afternoonStart;
      const end = addMinutes(start, 90);
      if (!this.hasOverlap(placed, day, start, end)) {
        placed.push(
          createSlot(
            context.scheduleId,
            {
              day,
              start,
              end,
              subject: "EPS",
              subSubject: "Piscine",
              slotType: "eps",
              room: "Piscine",
              hours: 1.5,
              lockLevel: "session",
            },
            sortOrder++,
          ),
        );
      }
    }

    if (context.variantType === "sorties") {
      for (const day of ["Jeudi", "Vendredi"]) {
        const start = context.settings.afternoonStart;
        const end = addMinutes(start, 120);
        if (!this.hasOverlap(placed, day, start, end)) {
          placed.push(
            createSlot(
              context.scheduleId,
              {
                day,
                start,
                end,
                subject: "Sortie scolaire",
                slotType: "sortie",
                hours: 2,
                lockLevel: "half_day",
              },
              sortOrder++,
            ),
          );
        }
      }
    }

    if (context.variantType === "evaluations") {
      for (const [day, subject] of [
        ["Lundi", "Français"],
        ["Mardi", "Mathématiques"],
        ["Jeudi", "Français"],
      ] as const) {
        const start = "08:30";
        const end = "10:30";
        if (!this.hasOverlap(placed, day, start, end)) {
          placed.push(
            createSlot(
              context.scheduleId,
              {
                day,
                start,
                end,
                subject,
                subSubject: "Évaluation",
                slotType: "evaluation",
                hours: 2,
                lockLevel: "session",
              },
              sortOrder++,
            ),
          );
        }
      }
    }

    return sortOrder;
  }

  private placeDecloisonnements(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    sortOrder: number,
  ): number {
    for (const block of context.settings.decloisonnements) {
      const window = this.findWindowForBlock(context, placed, block);
      if (!window) continue;

      placed.push(
        createSlot(
          context.scheduleId,
          {
            day: window.day,
            start: window.start,
            end: addMinutes(window.start, block.durationMinutes),
            subject: block.subjects.join(" / "),
            subSubject: block.label,
            slotType: "decloisonnement",
            label: block.label,
            hours: block.durationMinutes / 60,
            metadata: { subjects: block.subjects },
          },
          sortOrder++,
        ),
      );
    }

    return sortOrder;
  }

  private placeApcBlocks(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    sortOrder: number,
  ): number {
    for (const block of context.settings.apcSlots) {
      const window = this.findWindowForApc(context, placed, block);
      if (!window) continue;

      placed.push(
        createSlot(
          context.scheduleId,
          {
            day: window.day,
            start: window.start,
            end: addMinutes(window.start, block.durationMinutes),
            subject: block.subjects[0] ?? "APC",
            subSubject: block.label,
            slotType: "apc",
            label: block.label,
            hours: block.durationMinutes / 60,
            metadata: { subjects: block.subjects },
          },
          sortOrder++,
        ),
      );
    }

    return sortOrder;
  }

  private placeSubjectSessions(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    sortOrder: number,
  ): number {
    const placedHours = timetableValidator.computeWeeklyHours(placed);
    const windows = buildAvailableWindows(context.settings);
    const subjectPlan = this.buildSubjectPlan(context, placedHours);

    for (const item of subjectPlan) {
      const window = this.findBestWindow(context, placed, windows, item.subject, item.hours);
      if (!window) continue;

      const end =
        item.hours >= 2 && minutesBetween(window.start, window.end) >= 120
          ? addMinutes(window.start, 120)
          : window.end;

      placed.push(
        createSlot(
          context.scheduleId,
          {
            day: window.day,
            start: window.start,
            end,
            subject: item.subject,
            slotType: item.subject === "EPS" ? "eps" : "seance",
            room: item.subject === "EPS" ? "Gymnase" : "",
            hours: hoursFromSlot({ start: window.start, end, hours: item.hours }),
          },
          sortOrder++,
        ),
      );
    }

    return sortOrder;
  }

  private buildSubjectPlan(
    context: GeneratorContext,
    placedHours: Record<string, number>,
  ): Array<{ subject: string; hours: number }> {
    const plan: Array<{ subject: string; hours: number }> = [];

    const priority = [
      "Français",
      "Mathématiques",
      "EPS",
      "Questionner le monde",
      "Arts plastiques",
      "Éducation musicale",
      "Anglais",
      "EMC",
      "Informatique",
    ];

    for (const subject of priority) {
      const target = context.weeklyHoursTarget[subject];
      if (!target) continue;

      let remaining = target - (placedHours[subject] ?? 0);
      while (remaining > 0.25) {
        const chunk = remaining >= 2 ? 2 : remaining >= 1 ? 1 : remaining;
        plan.push({ subject, hours: chunk });
        remaining -= chunk;
      }
    }

    if (context.variantType === "piscine") {
      return plan.filter((item) => item.subject !== "EPS" || item.hours <= 1);
    }

    return plan;
  }

  private findBestWindow(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    windows: TimeWindow[],
    subject: string,
    hours: number,
  ): TimeWindow | null {
    const preferredDays = this.preferredDaysForSubject(subject, context.settings.schoolDays);
    const candidates = windows.filter((window) => {
      if (this.hasOverlap(placed, window.day, window.start, window.end)) return false;
      if (subject === "EPS" && window.period !== "afternoon") return false;
      const dayCount = placed.filter(
        (slot) =>
          slot.day === window.day &&
          !["recreation", "pause_meridienne", "rituel"].includes(slot.slotType),
      ).length;
      if (dayCount >= context.settings.maxSessionsPerDay) return false;
      return true;
    });

    const sorted = [...candidates].sort((a, b) => {
      const aPref = preferredDays.includes(a.day) ? 0 : 1;
      const bPref = preferredDays.includes(b.day) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;

      const aSubjectCount = placed.filter((slot) => slot.day === a.day && slot.subject === subject).length;
      const bSubjectCount = placed.filter((slot) => slot.day === b.day && slot.subject === subject).length;
      return aSubjectCount - bSubjectCount;
    });

    const match = sorted.find((window) => {
      const duration = minutesBetween(window.start, window.end);
      return duration >= hours * 60 - 5;
    });

    return match ?? sorted[0] ?? null;
  }

  private preferredDaysForSubject(subject: string, schoolDays: string[]): string[] {
    if (subject === "EPS") return [...EPS_PREFERRED_DAYS];
    if (subject === "Arts plastiques" || subject === "Éducation musicale") return [...ARTS_PREFERRED_DAYS];
    if (subject === "Questionner le monde") return [...QM_PREFERRED_DAYS];
    return schoolDays;
  }

  private findWindowForBlock(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    block: DecloisonnementBlock,
  ): TimeWindow | null {
    const windows = buildAvailableWindows(context.settings);
    const candidates = windows.filter(
      (window) =>
        (!block.day || window.day === block.day) &&
        !this.hasOverlap(placed, window.day, window.start, window.end) &&
        minutesBetween(window.start, window.end) >= block.durationMinutes,
    );
    return candidates[0] ?? null;
  }

  private findWindowForApc(
    context: GeneratorContext,
    placed: SmartTimetableSlot[],
    block: ApcBlock,
  ): TimeWindow | null {
    const windows = buildAvailableWindows(context.settings);
    const candidates = windows.filter(
      (window) =>
        (!block.day || window.day === block.day) &&
        (!block.start || window.start === block.start) &&
        !this.hasOverlap(placed, window.day, window.start, window.end) &&
        minutesBetween(window.start, window.end) >= block.durationMinutes,
    );
    return candidates[0] ?? null;
  }

  private hasOverlap(
    placed: SmartTimetableSlot[],
    day: string,
    start: string,
    end: string,
  ): boolean {
    return placed.some(
      (slot) => slot.day === day && slot.start < end && start < slot.end,
    );
  }
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + (em || 0) - (sh * 60 + (sm || 0)));
}

export const timetableGenerator = new TimetableGenerator();
