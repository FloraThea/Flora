import * as XLSX from "xlsx";
import type { TimetableImportSession } from "./types";
import { SCHOOL_DAYS } from "../types";

export function exportSessionsToWorkbook(
  sessions: TimetableImportSession[],
  meta: { className?: string; teacherName?: string; scheduleName?: string },
): Buffer {
  const days = [...SCHOOL_DAYS];
  const times = [...new Set(sessions.map((s) => s.startTime))].sort();

  const header = ["Horaire", ...days];
  const rows: string[][] = [header];

  if (meta.scheduleName) rows.unshift([`Emploi du temps — ${meta.scheduleName}`]);
  if (meta.className) rows.unshift([`Classe : ${meta.className}`]);
  if (meta.teacherName) rows.unshift([`Enseignant(e) : ${meta.teacherName}`]);
  if (meta.className || meta.teacherName || meta.scheduleName) rows.push([]);

  for (const time of times) {
    const row = [time];
    for (const day of days) {
      const session = sessions.find((s) => s.day === day && s.startTime === time);
      row.push(session ? session.rawLabel || session.subject : "");
    }
    rows.push(row);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Emploi du temps");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function exportSessionsToCsv(sessions: TimetableImportSession[]): string {
  const header = "jour;debut;fin;matiere;niveau;groupe;salle;notes";
  const lines = sessions.map((s) =>
    [s.day, s.startTime, s.endTime, s.subject, s.level, s.group, s.location, s.notes]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";"),
  );
  return [header, ...lines].join("\n");
}

export function sessionsToPrintHtml(
  sessions: TimetableImportSession[],
  meta: { scheduleName?: string; className?: string },
): string {
  const days = [...SCHOOL_DAYS];
  const times = [...new Set(sessions.map((s) => s.startTime))].sort();

  const cells = times
    .map((time) => {
      const dayCells = days
        .map((day) => {
          const session = sessions.find((s) => s.day === day && s.startTime === time);
          const label = session?.subject ?? "";
          const bg = session?.color ?? "#faf7f2";
          return `<td style="border:1px solid #ddd;padding:8px;background:${bg}">${label}</td>`;
        })
        .join("");
      return `<tr><td style="border:1px solid #ddd;padding:8px;font-weight:600">${time}</td>${dayCells}</tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${meta.scheduleName ?? "Emploi du temps"}</title>
<style>body{font-family:Georgia,serif;padding:24px;color:#3d3835}h1{font-size:22px}table{border-collapse:collapse;width:100%;margin-top:16px}th{background:#9caf88;color:white;padding:10px}</style></head>
<body><h1>${meta.scheduleName ?? "Emploi du temps Flora"}</h1>
${meta.className ? `<p>Classe : ${meta.className}</p>` : ""}
<table><thead><tr><th>Horaire</th>${days.map((d) => `<th>${d}</th>`).join("")}</tr></thead><tbody>${cells}</tbody></table></body></html>`;
}
