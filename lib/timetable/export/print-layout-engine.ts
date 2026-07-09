import type { SmartTimetableSlot } from "../types";
import {
  buildSubjectGradient,
  getPaletteKeyForSubject,
  getSubSubjectsForSubject,
  FLORA_PALETTE,
} from "../subject-palette";
import type { PrintScheduleRow } from "./types";
import { PREMIUM_PRINT_DAYS } from "./types";

const BREAK_TYPES = new Set(["recreation", "pause_meridienne"]);

export function resolvePrintDays(schoolDays: string[]): string[] {
  const preferred = PREMIUM_PRINT_DAYS.filter((day) => schoolDays.includes(day));
  if (preferred.length >= 3) return [...preferred];
  return schoolDays.filter((day) => day !== "Mercredi");
}

export function buildPrintScheduleRows(
  slots: SmartTimetableSlot[],
  days: string[],
): PrintScheduleRow[] {
  const relevantSlots = slots.filter((slot) => days.includes(slot.day));
  const starts = [...new Set(relevantSlots.map((slot) => slot.start))].sort((a, b) =>
    a.localeCompare(b),
  );

  return starts.map((start) => {
    const cells = days.map(
      (day) => relevantSlots.find((slot) => slot.day === day && slot.start === start) ?? null,
    );
    const activeCells = cells.filter(Boolean) as SmartTimetableSlot[];
    const breakCell = activeCells.find((slot) => BREAK_TYPES.has(slot.slotType));

    if (breakCell && activeCells.every((slot) => BREAK_TYPES.has(slot.slotType))) {
      return {
        kind: "break" as const,
        start,
        end: breakCell.end,
        slot: breakCell,
      };
    }

    const end = activeCells[0]?.end ?? "";
    return {
      kind: "slots" as const,
      start,
      end,
      cells,
    };
  });
}

export function resolvePrintCardBackground(
  slot: SmartTimetableSlot,
  useGradients: boolean,
  monochrome = false,
): { background: string; color: string; borderColor: string } {
  const paletteKey = getPaletteKeyForSubject(slot.subject, slot.slotType);
  const tone = FLORA_PALETTE[paletteKey];

  if (monochrome) {
    return {
      background: "#f3f3f3",
      color: "#222222",
      borderColor: "#cccccc",
    };
  }

  if (BREAK_TYPES.has(slot.slotType)) {
    if (slot.slotType === "recreation") {
      return {
        background: useGradients
          ? "linear-gradient(90deg, #faf3dc 0%, #f0e4b8 100%)"
          : "#faf3dc",
        color: tone.text,
        borderColor: tone.border,
      };
    }
    return {
      background: useGradients
        ? "linear-gradient(90deg, #fce8ef 0%, #f5e4e4 100%)"
        : "#fce8ef",
      color: tone.text,
      borderColor: tone.border,
    };
  }

  const gradient =
    slot.gradient?.trim() ||
    buildSubjectGradient(slot.subject, slot.subSubject, slot.slotType);

  const subs = getSubSubjectsForSubject(slot.subject);
  const subIndex = slot.subSubject ? subs.indexOf(slot.subSubject) : -1;
  const shade =
    subIndex >= 0
      ? subIndex / Math.max(subs.length - 1, 1)
      : slot.subSubject
        ? 0.45
        : 0.25;

  const background = useGradients
    ? gradient
    : subIndex >= 0
      ? shade > 0.5
        ? tone.light
        : tone.base
      : slot.color || tone.base;

  return {
    background,
    color: tone.text,
    borderColor: tone.border,
  };
}

export function extractSlotDetails(slot: SmartTimetableSlot): {
  objectif: string;
  competence: string;
  complementaryText: string;
} {
  const objectif =
    (typeof slot.metadata.objectif === "string" ? slot.metadata.objectif : "") || "";
  const competence =
    (typeof slot.metadata.competence === "string" ? slot.metadata.competence : "") ||
    (typeof slot.metadata.competenceBo === "string" ? slot.metadata.competenceBo : "") ||
    "";
  const complementaryText = slot.customText?.trim() || "";

  return { objectif, competence, complementaryText };
}

export function buildSchedulePrintMeta(input: {
  scheduleName: string;
  schoolYear?: string;
  levels?: string[];
  metadata?: Record<string, unknown>;
  variantLabel?: string;
}): {
  className: string;
  teacherName: string;
  schoolYear: string;
  period?: string;
  scheduleName: string;
  generatedAt: string;
} {
  const metadata = input.metadata ?? {};
  const className =
    String(metadata.className ?? "") ||
    (input.levels?.length ? input.levels.join(" / ") : "Classe");

  const teacherName = String(metadata.teacherName ?? "Enseignant·e");
  const schoolYear = input.schoolYear?.trim() || formatSchoolYear();
  const period = input.variantLabel || String(metadata.period ?? "") || undefined;

  return {
    className,
    teacherName,
    schoolYear,
    period,
    scheduleName: input.scheduleName,
    generatedAt: new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

function formatSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = month >= 7 ? year : year - 1;
  return `${start} - ${start + 1}`;
}
