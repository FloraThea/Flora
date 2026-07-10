import type { SmartTimetableSlot } from "../types";
import { getContrastTextColor } from "./print-theme";
import { getThemeBasePalette, getThemedSubjectOverride } from "@/lib/themes/subject-colors";
import type { FloraAppThemeId } from "@/lib/themes/types";
import {
  buildSubjectGradient,
  getPaletteKeyForSubject,
  getSubSubjectsForSubject,
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
  themeId: FloraAppThemeId = "flora",
): { background: string; color: string; borderColor: string } {
  const override = getThemedSubjectOverride(themeId, slot.subject, slot.subSubject);
  const paletteKey = getPaletteKeyForSubject(slot.subject, slot.slotType);
  const palette = getThemeBasePalette(themeId);
  const tone = palette[paletteKey];

  if (monochrome) {
    return {
      background: "#f3f3f3",
      color: "#1a1a1a",
      borderColor: "#cccccc",
    };
  }

  if (slot.metadata?.useCustomColor && slot.color) {
    const background = useGradients
      ? slot.gradient || slot.color
      : slot.color;
    return {
      background,
      color: getContrastTextColor(slot.color),
      borderColor: slot.color,
    };
  }

  if (BREAK_TYPES.has(slot.slotType)) {
    if (slot.slotType === "recreation") {
      const bg = useGradients
        ? "linear-gradient(90deg, #faf3dc 0%, #f0e4b8 100%)"
        : "#faf3dc";
      return {
        background: bg,
        color: getContrastTextColor(bg),
        borderColor: tone.border,
      };
    }
    const bg = useGradients
      ? "linear-gradient(90deg, #fce8ef 0%, #f5e4e4 100%)"
      : "#fce8ef";
    return {
      background: bg,
      color: getContrastTextColor(bg),
      borderColor: tone.border,
    };
  }

  const gradient =
    slot.gradient?.trim() ||
    buildSubjectGradient(slot.subject, slot.subSubject, slot.slotType, themeId);

  const subs = getSubSubjectsForSubject(slot.subject);
  const subIndex = slot.subSubject ? subs.indexOf(slot.subSubject) : -1;
  const shade =
    subIndex >= 0
      ? subIndex / Math.max(subs.length - 1, 1)
      : slot.subSubject
        ? 0.45
        : 0.25;

  const background = useGradients
    ? override ? themedGradient(override) : gradient
    : override
      ? override.base
      : subIndex >= 0
        ? shade > 0.5
          ? tone.light
          : tone.base
        : slot.color || tone.base;

  return {
    background,
    color: override?.text ?? getContrastTextColor(background),
    borderColor: override?.border ?? tone.border,
  };
}

function themedGradient(tone: {
  light: string;
  base: string;
  dark: string;
}): string {
  return `linear-gradient(145deg, ${tone.light} 0%, ${tone.base} 45%, ${tone.dark} 100%)`;
}

export function extractSlotDetails(slot: SmartTimetableSlot): {
  objectif: string;
  competence: string;
  complementaryText: string;
  displayTitle: string;
} {
  const objectif =
    (typeof slot.metadata.objectif === "string" ? slot.metadata.objectif : "") || "";
  const competence =
    (typeof slot.metadata.competence === "string" ? slot.metadata.competence : "") ||
    (typeof slot.metadata.competenceBo === "string" ? slot.metadata.competenceBo : "") ||
    "";
  const displayTitle =
    (typeof slot.metadata.displayText === "string" ? slot.metadata.displayText.trim() : "") ||
    slot.subject ||
    "";
  const complementaryText = slot.customText?.trim() || "";

  return { objectif, competence, complementaryText, displayTitle };
}

export function buildSchedulePrintMeta(input: {
  scheduleName: string;
  schoolYear?: string;
  levels?: string[];
  metadata?: Record<string, unknown>;
  variantLabel?: string;
  profile?: {
    prenom?: string;
    nom?: string;
    zoneScolaire?: string;
    levels?: string[];
    personalization?: { schoolName?: string };
  };
}): {
  className: string;
  teacherName: string;
  schoolYear: string;
  zone?: string;
  schoolName?: string;
  period?: string;
  scheduleName: string;
  generatedAt: string;
} {
  const metadata = input.metadata ?? {};
  const profile = input.profile;

  const className =
    String(metadata.className ?? "") ||
    (input.levels?.length ? input.levels.join(" / ") : "") ||
    (profile?.levels?.length ? profile.levels.join(" / ") : "Classe");

  const profileTeacher = [profile?.prenom, profile?.nom].filter(Boolean).join(" ").trim();
  const teacherName =
    profileTeacher ||
    String(metadata.teacherName ?? "").trim() ||
    "Enseignant·e";

  const schoolYear = input.schoolYear?.trim() || formatSchoolYear();
  const zone = profile?.zoneScolaire ? `Zone ${profile.zoneScolaire}` : undefined;
  const schoolName = profile?.personalization?.schoolName?.trim() || undefined;
  const period = input.variantLabel || String(metadata.period ?? "") || undefined;

  return {
    className,
    teacherName,
    schoolYear,
    zone,
    schoolName,
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
