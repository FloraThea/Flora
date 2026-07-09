export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysToIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function startOfWeek(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return toIsoDate(date);
}

export function endOfWeek(iso: string): string {
  return addDaysToIso(startOfWeek(iso), 6);
}

export function weekDates(iso: string): string[] {
  const start = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, index) => addDaysToIso(start, index));
}

export function startOfMonth(iso: string): string {
  const [year, month] = iso.split("-");
  return `${year}-${month}-01`;
}

export function endOfMonth(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setMonth(date.getMonth() + 1, 0);
  return toIsoDate(date);
}

export function monthGrid(iso: string): string[] {
  const start = new Date(`${startOfMonth(iso)}T12:00:00`);
  const gridStart = new Date(start);
  const day = gridStart.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  gridStart.setDate(gridStart.getDate() + offset);

  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(gridStart);
    cell.setDate(cell.getDate() + index);
    return toIsoDate(cell);
  });
}

export function formatShortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function tomorrowIso(): string {
  return addDaysToIso(todayIso(), 1);
}
