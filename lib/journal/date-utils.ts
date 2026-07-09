const FRENCH_DAYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

export function getFrenchDayName(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(`${dateInput}T12:00:00`) : dateInput;
  return FRENCH_DAYS[date.getDay()] ?? "lundi";
}

export function normalizeDayName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return 0;
  return Math.max(0, eh * 60 + (em || 0) - (sh * 60 + (sm || 0)));
}

export function formatDateLabel(dateInput: string): string {
  const date = new Date(`${dateInput}T12:00:00`);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function addDays(dateInput: string, days: number): string {
  const date = new Date(`${dateInput}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getWeekDates(dateInput: string): string[] {
  const date = new Date(`${dateInput}T12:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  return Array.from({ length: 5 }, (_, index) => {
    const next = new Date(monday);
    next.setDate(monday.getDate() + index);
    return next.toISOString().slice(0, 10);
  });
}

export function getMonthDates(dateInput: string): string[] {
  const date = new Date(`${dateInput}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const next = new Date(year, month, index + 1);
    return next.toISOString().slice(0, 10);
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function tomorrowIso(): string {
  return addDays(todayIso(), 1);
}
