/**
 * Test réel via routes HTTP Flora (analyze + save + list/details + reconnexion)
 * Usage :
 *   npm run dev
 *   npm run test:validation:api
 */
import fs from "node:fs";
import path from "node:path";
import {
  cleanupApiTestSession,
  createApiTestSession,
  type ApiTestSession,
} from "./lib/api-test-session";
import {
  importProgrammationViaApi,
  importProgressionViaApi,
  importTimetableViaApi,
  type ApiImportResult,
} from "./lib/api-import-flows";

const BASE_URL = process.env.FLORA_VALIDATION_BASE_URL ?? "http://localhost:3000";
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-api-http.md");

function assertImportResult(result: ApiImportResult) {
  const issues: string[] = [];
  if (result.savedCount !== result.expectedCount) {
    issues.push(`saved=${result.savedCount} expected=${result.expectedCount}`);
  }
  if (!result.listVisible) issues.push("absent de la liste");
  if (!result.detailsOk) issues.push("details incomplets");
  if (!result.afterReconnect) issues.push("absent après reconnexion");
  if (issues.length > 0) {
    throw new Error(`${result.kind} « ${result.title} » : ${issues.join(", ")}`);
  }
}

function writeReport(session: ApiTestSession, results: ApiImportResult[]) {
  const lines = [
    "# Validation réelle — enchaînement API HTTP",
    "",
    `- Base URL : \`${session.baseUrl}\``,
    `- Compte test : \`${session.email}\``,
    `- Date : ${new Date().toISOString()}`,
    "",
    "## Parcours testé",
    "",
    "1. `POST /api/auth/link-profile` (cookie `flora-auth-token`)",
    "2. `POST /api/*/import` multipart `action=analyze`",
    "3. `POST /api/*/import` JSON `action=save`",
    "4. `GET` list + details",
    "5. `DELETE /api/auth/link-profile` + reconnexion + revérification list",
    "",
    "## Résultats",
    "",
    "| Module | Titre | Attendu | Enregistré | Liste | Détails | Reconnexion |",
    "|--------|-------|---------|------------|-------|---------|-------------|",
    ...results.map(
      (result) =>
        `| ${result.kind} | ${result.title.slice(0, 40)} | ${result.expectedCount} | ${result.savedCount} | ${result.listVisible ? "✓" : "✗"} | ${result.detailsOk ? "✓" : "✗"} | ${result.afterReconnect ? "✓" : "✗"} |`,
    ),
    "",
    "## Statut",
    "",
    "✓ Tous les imports HTTP analyze → save → reload sont conformes.",
    "",
  ];

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, `${lines.join("\n")}\n`);
}

async function main() {
  let session: ApiTestSession | null = null;
  const results: ApiImportResult[] = [];

  try {
    session = await createApiTestSession(BASE_URL);

    console.log(`Session API : ${session.email}`);
    console.log(`Base URL : ${session.baseUrl}`);

    for (const runner of [
      { label: "Programmation HDA", fn: importProgrammationViaApi },
      { label: "Progression EMC", fn: importProgressionViaApi },
      { label: "Emploi du temps", fn: importTimetableViaApi },
    ]) {
      console.log(`\n→ ${runner.label} (analyze + save HTTP)…`);
      const result = await runner.fn(session);
      assertImportResult(result);
      results.push(result);
      console.log(
        `✓ ${runner.label} — ${result.savedCount}/${result.expectedCount}, list/details/reconnect OK`,
      );
    }

    writeReport(session, results);
    console.log(`\nRapport : ${REPORT_OUT}`);
    console.log("\nTest API HTTP : SUCCÈS");
  } finally {
    if (session) {
      await cleanupApiTestSession(session);
    }
  }
}

main().catch((error) => {
  console.error("\nTest API HTTP ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
