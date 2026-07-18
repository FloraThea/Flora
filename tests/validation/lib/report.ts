import fs from "node:fs";
import path from "node:path";
import type { CompareResult, ValidationDiff } from "./compare";
import type { ValidationDocument } from "./paths";

export type DocumentValidationResult = {
  document: ValidationDocument;
  ok: boolean;
  snapshotKind: string;
  statsSummary: string;
  diffs: ValidationDiff[];
  cellDiffs: ValidationDiff[];
  persistenceOk: boolean | null;
  persistenceDetail?: string;
  screenshotOk: boolean | null;
  screenshotDetail?: string;
};

export type ValidationReport = {
  generatedAt: string;
  mode: "compare" | "baseline";
  reliabilityScore: number;
  documentsTested: number;
  documentsPassed: number;
  regressions: number;
  results: DocumentValidationResult[];
};

export function buildValidationReport(input: {
  mode: "compare" | "baseline";
  results: DocumentValidationResult[];
}): ValidationReport {
  const documentsPassed = input.results.filter((result) => result.ok).length;
  const regressions = input.results.length - documentsPassed;
  const reliabilityScore =
    input.results.length === 0
      ? 0
      : Math.round((documentsPassed / input.results.length) * 100);

  return {
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    reliabilityScore,
    documentsTested: input.results.length,
    documentsPassed,
    regressions,
    results: input.results,
  };
}

export function writeValidationReport(report: ValidationReport, outputDir: string) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `validation-${stamp}.json`);
  const mdPath = path.join(outputDir, `validation-${stamp}.md`);
  const latestJson = path.join(outputDir, "latest.json");
  const latestMd = path.join(outputDir, "latest.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdownReport(report));
  fs.writeFileSync(latestJson, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestMd, renderMarkdownReport(report));

  return { jsonPath, mdPath, latestJson, latestMd };
}

function renderMarkdownReport(report: ValidationReport): string {
  const lines: string[] = [
    "# Rapport de validation Flora",
    "",
    `- Date : ${report.generatedAt}`,
    `- Mode : ${report.mode}`,
    `- Documents testés : ${report.documentsTested}`,
    `- Documents conformes : ${report.documentsPassed}`,
    `- Régressions : ${report.regressions}`,
    `- Note de fiabilité : **${report.reliabilityScore}/100**`,
    "",
    "## Résultats par document",
    "",
  ];

  for (const result of report.results) {
    lines.push(`### ${result.document.label} (\`${result.document.id}\`)`);
    lines.push("");
    lines.push(`- Statut : ${result.ok ? "✓ conforme" : "✗ régression"}`);
    lines.push(`- Type : ${result.snapshotKind}`);
    lines.push(`- Statistiques : ${result.statsSummary}`);
    if (result.persistenceOk !== null) {
      lines.push(
        `- Persistance Supabase : ${result.persistenceOk ? "✓" : "✗"}${result.persistenceDetail ? ` — ${result.persistenceDetail}` : ""}`,
      );
    }
    if (result.screenshotOk !== null) {
      lines.push(
        `- Captures : ${result.screenshotOk ? "✓" : "✗"}${result.screenshotDetail ? ` — ${result.screenshotDetail}` : ""}`,
      );
    }
    if (result.diffs.length > 0) {
      lines.push("- Différences détectées :");
      for (const diff of result.diffs.slice(0, 40)) {
        lines.push(`  - \`${diff.path}\` : attendu \`${stringify(diff.expected)}\`, obtenu \`${stringify(diff.actual)}\``);
      }
      if (result.diffs.length > 40) {
        lines.push(`  - … ${result.diffs.length - 40} différence(s) supplémentaire(s)`);
      }
    }
    if (result.cellDiffs.length > 0) {
      lines.push("- Écarts cellule source / interprétation :");
      for (const diff of result.cellDiffs.slice(0, 20)) {
        lines.push(`  - \`${diff.path}\` : attendu \`${stringify(diff.expected)}\`, obtenu \`${stringify(diff.actual)}\``);
      }
    }
    lines.push("");
  }

  lines.push("## Règle fondamentale");
  lines.push("");
  lines.push(
    "Aucune évolution ne doit être considérée terminée tant que `npm run test:validation` ne passe pas avec l’ensemble des documents de référence.",
  );

  return `${lines.join("\n")}\n`;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 120);
  return JSON.stringify(value)?.slice(0, 120) ?? "null";
}

export function summarizeStats(snapshot: Record<string, unknown>): string {
  const stats = snapshot.stats as Record<string, unknown> | undefined;
  if (!stats) return "—";
  return Object.entries(stats)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

export function summarizeCompare(compare: CompareResult): ValidationDiff[] {
  return compare.diffs;
}
