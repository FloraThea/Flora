import fs from "node:fs";
import path from "node:path";
import { compareSnapshots, verifySourceCellsPreserved } from "./lib/compare";
import { loadGuideSnapshot } from "./lib/extract-guide";
import { loadProgrammationSnapshot } from "./lib/extract-programmation";
import { loadTimetableSnapshot } from "./lib/extract-timetable";
import {
  checkProgrammationPersistence,
  checkTimetablePersistence,
} from "./lib/persistence-check";
import { readManifest, resolveValidationPath, type ValidationDocument } from "./lib/paths";
import {
  buildValidationReport,
  summarizeStats,
  writeValidationReport,
  type DocumentValidationResult,
} from "./lib/report";
import type { ValidationSnapshot } from "./lib/snapshot-types";

type RunOptions = {
  baseline: boolean;
  persistence: boolean;
  screenshots: boolean;
};

async function extractSnapshot(document: ValidationDocument): Promise<ValidationSnapshot> {
  const filePath = resolveValidationPath(document.file);
  switch (document.category) {
    case "programmation":
      return loadProgrammationSnapshot(filePath, "programmation");
    case "progression":
      return loadProgrammationSnapshot(filePath, "progression");
    case "emploi_du_temps":
      return loadTimetableSnapshot(filePath);
    case "guides_maitre":
      return loadGuideSnapshot(filePath);
    default:
      throw new Error(`Catégorie non supportée : ${document.category}`);
  }
}

function stripVolatile(snapshot: ValidationSnapshot): ValidationSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ValidationSnapshot;
}

async function validateDocument(
  document: ValidationDocument,
  options: RunOptions,
): Promise<DocumentValidationResult> {
  const actual = stripVolatile(await extractSnapshot(document));
  const expectedPath = resolveValidationPath(document.expected);
  let diffs = [] as ReturnType<typeof compareSnapshots>["diffs"];
  let cellDiffs = [] as ReturnType<typeof verifySourceCellsPreserved>;
  let ok = true;

  if (options.baseline) {
    fs.mkdirSync(path.dirname(expectedPath), { recursive: true });
    fs.writeFileSync(expectedPath, `${JSON.stringify(actual, null, 2)}\n`);
  } else if (!fs.existsSync(expectedPath)) {
    ok = false;
    diffs = [
      {
        path: "expected",
        expected: expectedPath,
        actual: "Fichier absent — exécuter npm run test:validation:baseline",
      },
    ];
  } else {
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8")) as ValidationSnapshot;
    const compare = compareSnapshots(expected, actual);
    diffs = compare.diffs;
    ok = compare.ok;

    if (actual.kind === "programmation" || actual.kind === "progression") {
      cellDiffs = verifySourceCellsPreserved(actual.sourceCells, actual.rows);
      if (cellDiffs.length > 0) ok = false;
    }

    if (actual.kind === "emploi_du_temps") {
      if (!actual.displayChecks.complementaryVisible) {
        ok = false;
        diffs.push({
          path: "displayChecks.complementaryVisible",
          expected: true,
          actual: false,
        });
      }
      if (!actual.displayChecks.duplicatePreservesComplementary) {
        ok = false;
        diffs.push({
          path: "displayChecks.duplicatePreservesComplementary",
          expected: true,
          actual: false,
        });
      }
    }
  }

  let persistenceOk: boolean | null = null;
  let persistenceDetail: string | undefined;
  if (options.persistence && !options.baseline) {
    if (actual.kind === "emploi_du_temps") {
      const result = await checkTimetablePersistence(actual);
      if (result) {
        persistenceOk = result.ok;
        persistenceDetail = result.detail;
        if (!result.ok) ok = false;
      }
    } else if (actual.kind === "programmation" || actual.kind === "progression") {
      const result = await checkProgrammationPersistence(actual);
      if (result) {
        persistenceOk = result.ok;
        persistenceDetail = result.detail;
        if (!result.ok) ok = false;
      }
    }
  }

  let screenshotOk: boolean | null = null;
  let screenshotDetail: string | undefined;
  if (options.screenshots) {
    screenshotOk = false;
    screenshotDetail =
      "Captures UI non générées — exécuter npm run test:validation:screenshots après npm run dev";
  }

  return {
    document,
    ok,
    snapshotKind: actual.kind,
    statsSummary: summarizeStats(actual as unknown as Record<string, unknown>),
    diffs,
    cellDiffs,
    persistenceOk,
    persistenceDetail,
    screenshotOk,
    screenshotDetail,
  };
}

export async function runValidationSuite(options: RunOptions) {
  const manifest = readManifest();
  const results: DocumentValidationResult[] = [];

  for (const document of manifest.documents) {
    const filePath = resolveValidationPath(document.file);
    if (!fs.existsSync(filePath)) {
      results.push({
        document,
        ok: false,
        snapshotKind: document.category,
        statsSummary: "—",
        diffs: [{ path: "file", expected: filePath, actual: "Fichier manquant" }],
        cellDiffs: [],
        persistenceOk: null,
        screenshotOk: null,
      });
      continue;
    }

    results.push(await validateDocument(document, options));
  }

  const report = buildValidationReport({
    mode: options.baseline ? "baseline" : "compare",
    results,
  });

  const paths = writeValidationReport(report, resolveValidationPath("rapports"));

  console.log(`\nValidation Flora — fiabilité ${report.reliabilityScore}/100`);
  console.log(`Documents : ${report.documentsPassed}/${report.documentsTested} conformes`);
  console.log(`Rapport : ${paths.latestMd}`);

  for (const result of results) {
    const icon = result.ok ? "✓" : "✗";
    console.log(`${icon} ${result.document.label} — ${result.statsSummary}`);
    if (!result.ok && result.diffs[0]) {
      console.log(`   ↳ ${result.diffs[0].path}`);
    }
  }

  if (report.regressions > 0 && !options.baseline) {
    process.exitCode = 1;
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  await runValidationSuite({
    baseline: args.has("--baseline"),
    persistence: args.has("--persistence"),
    screenshots: args.has("--screenshots"),
  });
}

main().catch((error) => {
  console.error("Validation Flora ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
