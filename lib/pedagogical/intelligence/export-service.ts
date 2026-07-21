import "server-only";

import * as XLSX from "xlsx";
import { onlyActive } from "@/lib/trash/active-query";
import { floraDb } from "@/lib/supabase/get-db";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { loadPilotagePayload } from "./pilotage-service";
import type { PedagogicalExportFormat, PedagogicalExportRequest } from "./types";

export type PedagogicalExportOutput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export async function exportPedagogicalYear(
  request: PedagogicalExportRequest,
): Promise<PedagogicalExportOutput> {
  const payload = await loadPilotagePayload(request.matiere);
  const scope = await requireTeacherScope();
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = request.scope === "matiere" && request.matiere ? request.matiere : "annee";
  const baseName = `flora-pilotage-${suffix}-${stamp}`;

  if (request.format === "excel") {
    const workbook = XLSX.utils.book_new();

    const indicatorSheet = XLSX.utils.aoa_to_sheet([
      ["Indicateur", "Valeur"],
      ["Année scolaire", payload.schoolYear],
      ["Progression réalisée (%)", payload.indicators.annualProgressPercent],
      ["Compétences couvertes", payload.indicators.competencesCovered],
      ["Compétences totales", payload.indicators.competencesTotal],
      ["Séances", payload.indicators.seanceCount],
      ["Progressions", payload.indicators.progressionCount],
      ["Programmations", payload.indicators.programmationCount],
      ["Temps prévu (h)", payload.indicators.plannedHoursTotal],
      ["Temps restant (h)", payload.indicators.remainingHoursTotal],
      ["Couverture BO (%)", payload.coverage.coveragePercent],
      ["Alertes cohérence", payload.coherence.issueCount],
    ]);
    XLSX.utils.book_append_sheet(workbook, indicatorSheet, "Indicateurs");

    const weekSheet = XLSX.utils.aoa_to_sheet([
      ["Semaine", "Période", "Début", "Fin", "Matières", "Compétences", "Séances", "Évals", "Projets", "Sorties"],
      ...payload.weeks.map((week) => [
        week.weekNumberInYear,
        week.periodNumber,
        week.startDate,
        week.endDate,
        week.subjects.join(", "),
        week.competences.join(", "),
        week.seanceCount,
        week.evaluationCount,
        week.projectCount,
        week.outingCount,
      ]),
    ]);
    XLSX.utils.book_append_sheet(workbook, weekSheet, "Semaines");

    const coverageSheet = XLSX.utils.aoa_to_sheet([
      ["Statut", "Compétence", "Modules"],
      ...payload.coverage.missing.map((item) => ["Absente", item.label, item.modules.join(", ")]),
      ...payload.coverage.partial.map((item) => ["Partielle", item.label, item.modules.join(", ")]),
      ...payload.coverage.covered.map((item) => ["Couverture", item.label, item.modules.join(", ")]),
    ]);
    XLSX.utils.book_append_sheet(workbook, coverageSheet, "Couverture BO");

    const coherenceSheet = XLSX.utils.aoa_to_sheet([
      ["Sévérité", "Message", "Raison", "Proposition"],
      ...payload.coherence.issues.map((issue) => [
        issue.severity,
        issue.message,
        issue.reason,
        issue.proposal ?? issue.suggestion ?? "",
      ]),
    ]);
    XLSX.utils.book_append_sheet(workbook, coherenceSheet, "Cohérence");

    if (request.scope === "matiere" && request.matiere) {
      const { data } = await onlyActive(
        (await floraDb())
          .from("progressions")
          .select("id, title, matiere")
          .eq("teacher_profile_id", scope.profileId)
          .eq("matiere", request.matiere),
      );
      const matiereSheet = XLSX.utils.aoa_to_sheet([
        ["Type", "Titre"],
        ...(data ?? []).map((row) => ["Progression", row.title]),
      ]);
      XLSX.utils.book_append_sheet(workbook, matiereSheet, request.matiere.slice(0, 31));
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return {
      fileName: `${baseName}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    };
  }

  const html = buildPilotageHtml(payload, request);
  const buffer = Buffer.from(html, "utf-8");

  if (request.format === "word") {
    return {
      fileName: `${baseName}.doc`,
      mimeType: "application/msword",
      buffer,
    };
  }

  return {
    fileName: `${baseName}-impression.html`,
    mimeType: "text/html; charset=utf-8",
    buffer,
  };
}

function buildPilotageHtml(
  payload: Awaited<ReturnType<typeof loadPilotagePayload>>,
  request: PedagogicalExportRequest,
): string {
  const title =
    request.scope === "matiere" && request.matiere
      ? `Pilotage pédagogique — ${request.matiere}`
      : "Pilotage pédagogique — Année complète";

  const issueRows = payload.coherence.issues
    .slice(0, 50)
    .map(
      (issue) =>
        `<tr><td>${issue.severity}</td><td>${escapeHtml(issue.message)}</td><td>${escapeHtml(issue.reason)}</td></tr>`,
    )
    .join("");

  const weekRows = payload.weeks
    .slice(0, 36)
    .map(
      (week) =>
        `<tr><td>S${week.weekNumberInYear}</td><td>P${week.periodNumber}</td><td>${week.startDate}</td><td>${week.subjects.join(", ")}</td><td>${week.seanceCount}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, serif; color: #1f2937; padding: 24px; }
    h1, h2 { color: #14532d; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #ecfdf5; }
    .meta { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">Généré le ${payload.generatedAt.slice(0, 16).replace("T", " ")} · Année ${payload.schoolYear}</p>

  <h2>Indicateurs</h2>
  <table>
    <tr><th>Progression réalisée</th><td>${payload.indicators.annualProgressPercent}%</td></tr>
    <tr><th>Compétences couvertes</th><td>${payload.indicators.competencesCovered} / ${payload.indicators.competencesTotal}</td></tr>
    <tr><th>Couverture BO</th><td>${payload.coverage.coveragePercent}%</td></tr>
    <tr><th>Séances</th><td>${payload.indicators.seanceCount}</td></tr>
    <tr><th>Temps prévu</th><td>${payload.indicators.plannedHoursTotal} h</td></tr>
    <tr><th>Temps restant</th><td>${payload.indicators.remainingHoursTotal} h</td></tr>
  </table>

  <h2>Semaines (${payload.weeks.length})</h2>
  <table>
    <thead><tr><th>Sem.</th><th>Pér.</th><th>Début</th><th>Matières</th><th>Séances</th></tr></thead>
    <tbody>${weekRows}</tbody>
  </table>

  <h2>Cohérence (${payload.coherence.issueCount})</h2>
  <table>
    <thead><tr><th>Niveau</th><th>Message</th><th>Raison</th></tr></thead>
    <tbody>${issueRows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
