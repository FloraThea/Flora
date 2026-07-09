import type { JournalExportFormat, JournalExportVariant, JournalPayload } from "./types";
import { formatDateLabel } from "./date-utils";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderList(items: string[]): string {
  if (items.length === 0) return "<li>—</li>";
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

export class JournalExporter {
  exportHtml(payload: JournalPayload, variant: JournalExportVariant = "teacher"): string {
    const { journal, entries } = payload;
    const isSubstitute = variant === "substitute";

    const entrySections = entries
      .map((entry) => {
        if (isSubstitute) {
          return `
            <section class="entry substitute">
              <h3>${escapeHtml(entry.startTime)} – ${escapeHtml(entry.endTime)} · ${escapeHtml(entry.matiere)}</h3>
              <p><strong>Objectif :</strong> ${escapeHtml(entry.objectif || entry.ritualLabel)}</p>
              <p><strong>Organisation :</strong> ${escapeHtml(entry.organisation)}</p>
              <p><strong>Matériel :</strong></p>
              <ul>${renderList(entry.materiel.items)}</ul>
              <p><strong>Documents :</strong></p>
              <ul>${renderList(entry.documents)}</ul>
            </section>
          `;
        }

        return `
          <section class="entry">
            <h3>${escapeHtml(entry.startTime)} – ${escapeHtml(entry.endTime)} · ${escapeHtml(entry.matiere)}</h3>
            ${entry.ritualLabel ? `<p><strong>Rituel :</strong> ${escapeHtml(entry.ritualLabel)}</p>` : ""}
            <p><strong>Objectif :</strong> ${escapeHtml(entry.objectif)}</p>
            <p><strong>Compétence :</strong> ${escapeHtml(entry.competence)}</p>
            <p><strong>Durée :</strong> ${entry.dureeMinutes} min</p>
            <p><strong>Organisation :</strong> ${escapeHtml(entry.organisation)}</p>
            <p><strong>Matériel :</strong></p>
            <ul>${renderList(entry.materiel.items)}</ul>
            <p><strong>Documents / ressources :</strong></p>
            <ul>${renderList([...entry.documents, ...entry.resources.guides, ...entry.resources.albums, ...entry.resources.fiches])}</ul>
            <p><strong>Observations :</strong> ${escapeHtml(entry.observation?.comments ?? entry.observations)}</p>
          </section>
        `;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Cahier journal — ${escapeHtml(journal.journalDate)}</title>
  <style>
    body { font-family: Georgia, serif; color: #3d3835; padding: 32px; line-height: 1.5; }
    h1, h2, h3 { font-weight: 500; }
    .entry { margin-bottom: 24px; page-break-inside: avoid; border: 1px solid #eee; border-radius: 12px; padding: 16px; }
    .substitute { background: #faf8f6; }
    ul { padding-left: 20px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Cahier journal${isSubstitute ? " — version remplaçant" : ""}</h1>
  <p>${escapeHtml(formatDateLabel(journal.journalDate))}</p>
  <p><strong>Classe :</strong> ${escapeHtml(journal.className)} · <strong>Effectif :</strong> ${journal.effectif} · <strong>Présents :</strong> ${journal.presents}</p>
  <p><strong>Projet :</strong> ${escapeHtml(journal.dailyProject)}</p>
  <h2>Objectifs principaux</h2>
  <ul>${renderList(journal.mainObjectives)}</ul>
  ${journal.importantInfo ? `<p><strong>Informations :</strong> ${escapeHtml(journal.importantInfo)}</p>` : ""}
  <h2>Créneaux</h2>
  ${entrySections}
</body>
</html>`;
  }

  export(payload: JournalPayload, format: JournalExportFormat, variant: JournalExportVariant): {
    content: string;
    mimeType: string;
    fileName: string;
  } {
    const html = this.exportHtml(payload, variant);
    const suffix = variant === "substitute" ? "remplacant" : "enseignant";

    if (format === "pdf") {
      return {
        content: html,
        mimeType: "text/html",
        fileName: `cahier-journal-${payload.journal.journalDate}-${suffix}-print.pdf.html`,
      };
    }

    if (format === "word") {
      return {
        content: html,
        mimeType: "application/msword",
        fileName: `cahier-journal-${payload.journal.journalDate}-${suffix}.doc`,
      };
    }

    return {
      content: html,
      mimeType: "text/html",
      fileName: `cahier-journal-${payload.journal.journalDate}-${suffix}.html`,
    };
  }

  exportRange(
    payloads: JournalPayload[],
    scope: "week" | "period",
    variant: JournalExportVariant = "teacher",
  ): string {
    const sections = payloads
      .map((payload) => {
        const body = this.exportHtml(payload, variant);
        return body.replace(/<!DOCTYPE html>[\s\S]*<body>/, "").replace(/<\/body>[\s\S]*$/, "");
      })
      .join('<div style="page-break-before:always"></div>');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Cahier journal — ${scope}</title>
  <style>
    body { font-family: Georgia, serif; color: #3d3835; padding: 32px; line-height: 1.5; }
    h1, h2, h3 { font-weight: 500; }
    .entry { margin-bottom: 24px; page-break-inside: avoid; border: 1px solid #eee; border-radius: 12px; padding: 16px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Cahier journal — ${scope === "week" ? "Semaine" : "Période"}</h1>
  ${sections}
</body>
</html>`;
  }
}

export const journalExporter = new JournalExporter();
