import type { SequencePayload } from "./types";

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

function buildHtml(payload: SequencePayload): string {
  const sequence = payload.sequence;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sequence.title)}</title>
  <style>
    body { font-family: Georgia, serif; color: #3d3835; padding: 32px; }
    h1, h2 { color: #b88989; }
    section { margin-bottom: 28px; }
    ul { margin: 0; padding-left: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e8c4c4; padding: 8px; vertical-align: top; }
  </style>
</head>
<body>
  <h1>${escapeHtml(sequence.title)}</h1>
  <p>${escapeHtml(sequence.matiere)} · ${escapeHtml(sequence.sousMatiere)} · ${escapeHtml(sequence.niveau)} · ${escapeHtml(sequence.cycle)}</p>
  <p>Période ${sequence.periodNumber} · Semaines ${sequence.weekNumbers.join(", ")} · ${sequence.sessionCount} séances · ${sequence.dureeEstimeeMinutes} min</p>

  <section>
    <h2>Compétence et objectifs</h2>
    <p><strong>Compétence BO :</strong> ${escapeHtml(sequence.competenceBo)}</p>
    <p><strong>Attendus :</strong></p><ul>${renderList(sequence.attendus)}</ul>
    <p><strong>Objectifs :</strong></p><ul>${renderList(sequence.objectifs)}</ul>
    <p><strong>Prérequis :</strong></p><ul>${renderList(sequence.prerequis)}</ul>
  </section>

  <section>
    <h2>Séances</h2>
    <table>
      <thead><tr><th>#</th><th>Titre</th><th>Objectif</th><th>Durée</th><th>Place</th></tr></thead>
      <tbody>
        ${payload.sessions
          .map(
            (session) => `
              <tr>
                <td>${session.sessionNumber}</td>
                <td>${escapeHtml(session.title)}</td>
                <td>${escapeHtml(session.objectif)}</td>
                <td>${session.dureeMinutes} min</td>
                <td>${escapeHtml(session.placeProgression)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Évaluations</h2>
    ${payload.evaluations
      .map(
        (evaluation) => `
          <p><strong>${escapeHtml(evaluation.label)}</strong></p>
          <ul>${renderList(evaluation.criteres)}</ul>
        `,
      )
      .join("")}
  </section>

  <section>
    <h2>Différenciation</h2>
    <p><strong>Élèves en difficulté</strong></p><ul>${renderList(sequence.differentiation.elevesEnDifficulte)}</ul>
    <p><strong>Élèves avancés</strong></p><ul>${renderList(sequence.differentiation.elevesAvances)}</ul>
    <p><strong>Groupes</strong></p><ul>${renderList(sequence.differentiation.groupes)}</ul>
    <p><strong>Adaptations</strong></p><ul>${renderList(sequence.differentiation.adaptations)}</ul>
  </section>

  <section>
    <h2>Ressources et matériel</h2>
    <p><strong>Ressources :</strong></p><ul>${renderList(sequence.resources)}</ul>
    <p><strong>Matériel :</strong></p><ul>${renderList(sequence.materiel)}</ul>
  </section>
</body>
</html>`;
}

export class SequenceExporter {
  exportToWord(payload: SequencePayload): Blob {
    return new Blob([buildHtml(payload)], {
      type: "application/msword;charset=utf-8",
    });
  }

  exportToPdf(payload: SequencePayload): Blob {
    return new Blob([buildHtml(payload)], {
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

  exportPayload(payload: SequencePayload, format: "word" | "pdf") {
    const baseName = payload.sequence.title || "sequence";

    if (format === "word") {
      this.downloadBlob(this.exportToWord(payload), `${baseName}.doc`);
      return;
    }

    const url = URL.createObjectURL(this.exportToPdf(payload));
    const printWindow = window.open(url, "_blank");
    printWindow?.addEventListener("load", () => printWindow.print());
  }
}

export const sequenceExporter = new SequenceExporter();
