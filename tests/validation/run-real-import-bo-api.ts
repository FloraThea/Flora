/**
 * Test réel BO — upload HTTP + extraction via API Flora
 *
 * Usage :
 *   npm run dev
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs tests/validation/run-real-import-bo-api.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createApiTestSession, cleanupApiTestSession, type ApiTestSession } from "./lib/api-test-session";

const BASE_URL = process.env.FLORA_VALIDATION_BASE_URL ?? "http://localhost:3000";
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-bo-api-http.md");

function resolveBoPdfPath(): string {
  const fromEnv = process.env.FLORA_VALIDATION_BO_PDF?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);

  const downloads = path.join(process.env.HOME ?? "", "Downloads");
  if (fs.existsSync(downloads)) {
    const match = fs
      .readdirSync(downloads)
      .find((name) => name.endsWith("-405261.pdf") || /405261\.pdf$/i.test(name));
    if (match) return path.join(downloads, match);
  }

  throw new Error("PDF BO introuvable (FLORA_VALIDATION_BO_PDF ou ~/Downloads/*405261.pdf).");
}

async function importBoViaApi(session: ApiTestSession, filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const form = new FormData();
  form.append("file", new File([buffer], fileName, { type: "application/pdf" }));

  const response = await fetch(`${session.baseUrl}/api/centre-ressources/import`, {
    method: "POST",
    headers: {
      Cookie: session.cookieHeader,
    },
    body: form,
  });

  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    details?: string;
    textLength?: number;
    pageCount?: number;
    documentId?: string;
    documentStatus?: string;
    preview?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || data.details || `Import BO HTTP ${response.status}: ${JSON.stringify(data)}`,
    );
  }

  return data;
}

function writeReport(input: {
  filePath: string;
  result: Awaited<ReturnType<typeof importBoViaApi>>;
}) {
  const lines = [
    "# Validation réelle — Import BO via API HTTP",
    "",
    `- Base URL : \`${BASE_URL}\``,
    `- Fichier : \`${input.filePath}\``,
    `- Date : ${new Date().toISOString()}`,
    "",
    "## Résultat",
    "",
    `- Succès : ${input.result.success ? "oui" : "non"}`,
    `- Document ID : ${input.result.documentId ?? "—"}`,
    `- Statut : ${input.result.documentStatus ?? "—"}`,
    `- Pages : ${input.result.pageCount ?? "—"}`,
    `- Caractères extraits : ${input.result.textLength ?? "—"}`,
    "",
    "## Aperçu",
    "",
    "```",
    String(input.result.preview ?? "").slice(0, 500),
    "```",
    "",
  ];

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, `${lines.join("\n")}\n`);
}

async function main() {
  const filePath = resolveBoPdfPath();
  const session = await createApiTestSession(BASE_URL);

  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Fichier BO : ${path.basename(filePath)}`);

  try {
    const result = await importBoViaApi(session, filePath);
    writeReport({ filePath, result });

    if (!result.textLength || result.textLength < 500) {
      throw new Error(`Texte extrait insuffisant : ${result.textLength ?? 0} caractères`);
    }

    console.log(`✓ Import BO — ${result.pageCount ?? "?"} pages, ${result.textLength} caractères`);
    console.log(`✓ Document : ${result.documentId} (${result.documentStatus})`);
    console.log(`Rapport : ${REPORT_OUT}`);
    console.log("\nTest BO API HTTP : SUCCÈS");
  } finally {
    await cleanupApiTestSession(session);
  }
}

main().catch((error) => {
  console.error("\nTest BO API HTTP : ÉCHEC", error instanceof Error ? error.message : error);
  process.exit(1);
});
