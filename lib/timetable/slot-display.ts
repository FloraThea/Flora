import type { SmartTimetableSlot } from "./types";
import { readSlotMeta } from "./slot-editor/operations";

export type SlotCardDisplay = {
  timeLabel: string;
  subject: string;
  subSubject: string;
  complementaryText: string;
  levels: string[];
  tooltip: string;
};

/** Texte complémentaire = colonne `custom_text` / champ `customText`. */
export function resolveSlotComplementaryText(slot: SmartTimetableSlot): string {
  return slot.customText?.trim() || "";
}

export function resolveSlotCardDisplay(slot: SmartTimetableSlot): SlotCardDisplay {
  const meta = readSlotMeta(slot);
  const subject = slot.subject?.trim() || "Créneau";
  const subSubject = slot.subSubject?.trim() || "";
  const complementaryText = resolveSlotComplementaryText(slot);
  const levels = meta.levels ?? [];
  const timeLabel = `${slot.start} – ${slot.end}`;

  const tooltip = [timeLabel, subject, subSubject, complementaryText, levels.join(" · ")]
    .filter(Boolean)
    .join(" · ");

  return {
    timeLabel,
    subject,
    subSubject,
    complementaryText,
    levels,
    tooltip,
  };
}

export function buildExportCardContentLines(input: {
  subject: string;
  subSubject?: string;
  complementaryText?: string;
}): Array<{ text: string; role: "subject" | "subSubject" | "complementary" }> {
  const lines: Array<{ text: string; role: "subject" | "subSubject" | "complementary" }> = [];
  const subject = input.subject.trim();
  const subSubject = input.subSubject?.trim() ?? "";
  const complementaryText = input.complementaryText?.trim() ?? "";

  if (subject) lines.push({ text: subject, role: "subject" });
  if (subSubject) lines.push({ text: subSubject, role: "subSubject" });
  if (complementaryText) lines.push({ text: complementaryText, role: "complementary" });

  return lines;
}
