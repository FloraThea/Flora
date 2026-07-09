import type { SeancePayload } from "./types";

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

function buildHtml(payload: SeancePayload): string {
  const { seance, phases } = payload;

  const phaseSections = phases
    .map((phase) => {
      const activities = phase.activities
        .map(
          (activity) => `
            <div class="activity">
              <h4>${escapeHtml(activity.objectif)}</h4>
              <p><strong>Enseignant :</strong> ${escapeHtml(activity.consignesEnseignant)}</p>
              <p><strong>Élèves :</strong> ${escapeHtml(activity.consignesEleves)}</p>
              <p><strong>Organisation :</strong> ${escapeHtml(activity.organisation)}</p>
              <p><strong>Durée :</strong> ${activity.dureeMinutes} min</p>
              <p><strong>Questions :</strong></p><ul>${renderList(activity.questions)}</ul>
            </div>
          `,
        )
        .join("");

      return `
        <section>
          <h3>${escapeHtml(phase.title)} (${phase.dureeMinutes} min)</h3>
          <p>${escapeHtml(phase.summary)}</p>
          ${activities}
        </section>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(seance.title)}</title>
  <style>
    body { font-family: Georgia, serif; color: #3d3835; padding: 32px; line-height: 1.5; }
    h1, h2, h3 { font-weight: 500; }
    section { margin-bottom: 24px; page-break-inside: avoid; }
    .activity { margin: 12px 0; padding: 12px; border: 1px solid #eee; border-radius: 12px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(seance.title)}</h1>
  <p>${escapeHtml(seance.matiere)} · ${escapeHtml(seance.sousMatiere)} · ${escapeHtml(seance.niveau)} · ${escapeHtml(seance.cycle)}</p>
  <p>Période ${seance.periodNumber} · Semaine ${seance.weekNumber} · ${seance.dureeMinutes} min</p>
  <h2>Objectif</h2><p>${escapeHtml(seance.objectif)}</p>
  <h2>Compétence BO</h2><p>${escapeHtml(seance.competenceBo)}</p>
  <h2>Choix pédagogiques</h2><ul>${renderList(seance.pedagogicalChoices)}</ul>
  <h2>Déroulé</h2>
  ${phaseSections}
  <h2>Trace écrite élève</h2><pre>${escapeHtml(seance.traceEcrite.eleve)}</pre>
  <h2>Évaluation formative</h2><p>${escapeHtml(seance.evaluation.formative)}</p>
</body>
</html>`;
}

function buildPptHtml(payload: SeancePayload): string {
  const { seance, phases } = payload;
  const slides = [
    `<section><h1>${escapeHtml(seance.title)}</h1><p>${escapeHtml(seance.objectif)}</p></section>`,
    ...phases.map(
      (phase) =>
        `<section><h2>${escapeHtml(phase.title)}</h2><p>${escapeHtml(phase.summary)}</p></section>`,
    ),
    `<section><h2>Trace écrite</h2><pre>${escapeHtml(seance.traceEcrite.eleve)}</pre></section>`,
  ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(seance.title)}</title></head><body>${slides.join("")}</body></html>`;
}

export class LessonExporter {
  exportToWord(payload: SeancePayload): Blob {
    return new Blob([buildHtml(payload)], { type: "application/msword;charset=utf-8" });
  }

  exportToPdf(payload: SeancePayload): Blob {
    return new Blob([buildHtml(payload)], { type: "text/html;charset=utf-8" });
  }

  exportToPowerPoint(payload: SeancePayload): Blob {
    return new Blob([buildPptHtml(payload)], { type: "application/vnd.ms-powerpoint;charset=utf-8" });
  }

  downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  exportPayload(payload: SeancePayload, format: "word" | "pdf" | "ppt" | "print") {
    const baseName = payload.seance.title || "seance";

    if (format === "word") {
      this.downloadBlob(this.exportToWord(payload), `${baseName}.doc`);
      return;
    }

    if (format === "ppt") {
      this.downloadBlob(this.exportToPowerPoint(payload), `${baseName}.ppt`);
      return;
    }

    const blob = this.exportToPdf(payload);
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    if (format === "print") {
      printWindow?.addEventListener("load", () => printWindow.print());
    } else {
      printWindow?.addEventListener("load", () => printWindow.print());
    }
  }
}

export const lessonExporter = new LessonExporter();
