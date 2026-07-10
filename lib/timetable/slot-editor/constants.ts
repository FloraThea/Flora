import { getSubjectIcon } from "@/lib/timetable/export/print-theme";
import type { SlotLevel } from "./operations";

export const SLOT_LEVELS: SlotLevel[] = ["CP", "CE1", "CE2", "Multi-niveaux"];

export const SLOT_ICON_OPTIONS = [
  "📚",
  "📖",
  "✍️",
  "➗",
  "🎨",
  "🏃",
  "🌍",
  "🧪",
  "🎵",
  "💬",
  "🕊",
  "✨",
  "🌱",
  "📘",
  "☀️",
  "🍴",
  "🏛️",
  "🔢",
  "📝",
  "🎯",
] as const;

export function defaultIconForSlot(subject: string, subSubject = "", slotType?: string): string {
  return getSubjectIcon(subject, subSubject, slotType);
}

export function formatDurationLabel(minutes: number): string {
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}
