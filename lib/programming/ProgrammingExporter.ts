import type {
  ProgrammationPayload,
  ProgrammingTable,
  StoredProgrammation,
  ValidationResult,
} from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCellLines(items: string[]): string {
  if (items.length === 0) return "—";
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function buildHtmlDocument(
  programmation: StoredProgrammation,
  tables: ProgrammingTable[],
): string {
  const tableSections = tables
    .map((table) => {
      const header = table.subSubjectLabel || table.subjectLabel;
      const columns = table.periods
        .map(
          (period) => `
            <th>
              ${escapeHtml(period.label)}<br />
              <small>${period.weekCount} sem.</small>
            </th>
          `,
        )
        .join("");

      const cells = table.periods
        .map(
          (period) => `
            <td>
              ${period.cell.content ? `<p><strong>${escapeHtml(period.cell.content)}</strong></p>` : ""}
              <p><strong>Compétences</strong></p><ul>${renderCellLines(period.cell.competences)}</ul>
              <p><strong>Notions</strong></p><ul>${renderCellLines(period.cell.notions)}</ul>
              <p><strong>Ressources</strong></p><ul>${renderCellLines(period.cell.resources)}</ul>
              <p><strong>Guides</strong></p><ul>${renderCellLines(period.cell.guides)}</ul>
              <p><strong>Modules</strong></p><ul>${renderCellLines(period.cell.modules)}</ul>
            </td>
          `,
        )
        .join("");

      return `
        <section>
          <h2>${escapeHtml(header)}</h2>
          <table>
            <thead><tr>${columns}</tr></thead>
            <tbody><tr>${cells}</tr></tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(programmation.title)}</title>
  <style>
    body { font-family: Georgia, serif; color: #3d3835; padding: 32px; }
    h1, h2 { color: #b88989; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th, td { border: 1px solid #e8c4c4; padding: 12px; vertical-align: top; border-radius: 12px; }
    th { background: #fdf8f6; }
    td { background: #fff; }
    small { color: #8a8480; }
    ul { margin: 0; padding-left: 18px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(programmation.title)}</h1>
  <p>${escapeHtml(programmation.school_year)} · Zone ${escapeHtml(programmation.academic_zone)} · ${escapeHtml(programmation.levels.join(", "))}</p>
  <p>Méthode : ${escapeHtml(programmation.methode || "—")} · Projet : ${escapeHtml(programmation.projet_annuel || "—")}</p>
  ${tableSections}
</body>
</html>`;
}

/**
 * Exporte une programmation en Word, Excel et PDF (via HTML fidèle).
 */
export class ProgrammingExporter {
  exportToWord(programmation: StoredProgrammation, tables: ProgrammingTable[]): Blob {
    const html = buildHtmlDocument(programmation, tables);
    return new Blob([html], {
      type: "application/msword;charset=utf-8",
    });
  }

  exportToExcel(programmation: StoredProgrammation, tables: ProgrammingTable[]): Blob {
    const rows: string[][] = [
      [
        "Matière",
        "Sous-matière",
        "Période",
        "Semaines",
        "Contenu",
        "Compétences",
        "Notions",
        "Ressources",
        "Guides",
        "Modules",
      ],
    ];

    tables.forEach((table) => {
      table.periods.forEach((period) => {
        rows.push([
          table.subjectLabel,
          table.subSubjectLabel,
          period.label,
          String(period.weekCount),
          period.cell.content,
          period.cell.competences.join(" | "),
          period.cell.notions.join(" | "),
          period.cell.resources.join(" | "),
          period.cell.guides.join(" | "),
          period.cell.modules.join(" | "),
        ]);
      });
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${cell.replace(/"/g, '""')}"`)
          .join(";"),
      )
      .join("\n");

    return new Blob(["\uFEFF", csv], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
  }

  exportToPdf(programmation: StoredProgrammation, tables: ProgrammingTable[]): Blob {
    const html = buildHtmlDocument(programmation, tables).replace(
      "</style>",
      `@media print { body { padding: 0; } section { break-inside: avoid; } }</style>`,
    );

    return new Blob([html], {
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

  exportPayload(
    payload: ProgrammationPayload,
    format: "word" | "excel" | "pdf",
  ) {
    const baseName = payload.programmation.title || "programmation";

    if (format === "word") {
      this.downloadBlob(
        this.exportToWord(payload.programmation, payload.tables),
        `${baseName}.doc`,
      );
      return;
    }

    if (format === "excel") {
      this.downloadBlob(
        this.exportToExcel(payload.programmation, payload.tables),
        `${baseName}.xls`,
      );
      return;
    }

    const pdfBlob = this.exportToPdf(payload.programmation, payload.tables);
    const url = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(url, "_blank");
    printWindow?.addEventListener("load", () => {
      printWindow.print();
    });
  }
}

export const programmingExporter = new ProgrammingExporter();

export function buildValidationReport(validation: ValidationResult): string {
  if (validation.valid && validation.issues.length === 0) {
    return "Programmation validée.";
  }

  return validation.issues
    .map((issue) => `${issue.severity === "error" ? "Erreur" : "Avertissement"} : ${issue.message}`)
    .join("\n");
}
