import type { ProgressionPayload } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderList(items: string[]): string {
  if (items.length === 0) return "—";
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function buildHtmlDocument(payload: ProgressionPayload): string {
  const sections = payload.tabs
    .map((tab) => {
      const title = tab.subSubjectLabel || tab.subjectLabel;
      const rows = tab.rows
        .map(
          (row) => `
          <tr>
            <td>P${row.periodNumber}</td>
            <td>S${row.weekNumber}</td>
            <td>${escapeHtml(row.sequenceModule)}</td>
            <td>${escapeHtml(row.seanceLabel)}</td>
            <td>${escapeHtml(row.competenceBo)}</td>
            <td><ul>${renderList(row.objectifs)}</ul></td>
            <td>${escapeHtml(row.deroulement)}</td>
            <td><ul>${renderList(row.materiel)}</ul></td>
            <td><ul>${renderList(row.resources)}</ul></td>
            <td>${escapeHtml(row.remarques)}</td>
          </tr>
        `,
        )
        .join("");

      return `
        <section>
          <h2>${escapeHtml(title)}</h2>
          <table>
            <thead>
              <tr>
                <th>Période</th><th>Semaine</th><th>Séquence / Module</th><th>Séance</th>
                <th>Compétence BO</th><th>Objectifs</th><th>Déroulement</th><th>Matériel</th>
                <th>Ressources</th><th>Remarques</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.progression.title)}</title>
  <style>
    body { font-family: Georgia, serif; color: #3d3835; padding: 32px; }
    h1, h2 { color: #b88989; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 12px; }
    th, td { border: 1px solid #e8c4c4; padding: 8px; vertical-align: top; }
    th { background: #fdf8f6; }
    ul { margin: 0; padding-left: 16px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(payload.progression.title)}</h1>
  <p>Méthode : ${escapeHtml(payload.progression.methode)}</p>
  ${sections}
</body>
</html>`;
}

export class ProgressionExporter {
  exportToWord(payload: ProgressionPayload): Blob {
    return new Blob([buildHtmlDocument(payload)], {
      type: "application/msword;charset=utf-8",
    });
  }

  exportToExcel(payload: ProgressionPayload): Blob {
    const header = [
      "Matière",
      "Sous-matière",
      "Période",
      "Semaine",
      "Séance",
      "Séquence / Module",
      "Compétence BO",
      "Objectifs",
      "Déroulement",
      "Matériel",
      "Ressources",
      "Remarques",
    ];

    const rows: string[][] = [header];

    payload.tabs.forEach((tab) => {
      tab.rows.forEach((row) => {
        rows.push([
          tab.subjectLabel,
          tab.subSubjectLabel,
          String(row.periodNumber),
          String(row.weekNumber),
          row.seanceLabel,
          row.sequenceModule,
          row.competenceBo,
          row.objectifs.join(" | "),
          row.deroulement,
          row.materiel.join(" | "),
          row.resources.join(" | "),
          row.remarques,
        ]);
      });
    });

    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    return new Blob(["\uFEFF", csv], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
  }

  exportToPdf(payload: ProgressionPayload): Blob {
    return new Blob([buildHtmlDocument(payload)], {
      type: "text/html;charset=utf-8",
    });
  }

  downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  exportPayload(payload: ProgressionPayload, format: "word" | "excel" | "pdf") {
    const baseName = payload.progression.title || "progression";

    if (format === "word") {
      this.downloadBlob(this.exportToWord(payload), `${baseName}.doc`);
      return;
    }

    if (format === "excel") {
      this.downloadBlob(this.exportToExcel(payload), `${baseName}.xls`);
      return;
    }

    const url = URL.createObjectURL(this.exportToPdf(payload));
    const printWindow = window.open(url, "_blank");
    printWindow?.addEventListener("load", () => printWindow.print());
  }
}

export const progressionExporter = new ProgressionExporter();
