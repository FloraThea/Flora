/**
 * Test réel — Import BO + analyse Théa (Gemini)
 *
 * Usage :
 *   npm run dev
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs tests/validation/run-real-import-bo-analyze.ts
 *
 * L'analyse HTTP peut dépasser 5 min en `next dev` (connexion coupée) ; le test
 * relance l'appel puis interroge Supabase jusqu'à statut ANALYZED.
 * Route HTTP stricte (sans polling) : FLORA_VALIDATION_BO_ANALYZE_HTTP=1
 */
import fs from "node:fs";
import path from "node:path";
import {
  cleanupApiTestSession,
  createApiTestSession,
  type ApiTestSession,
} from "./lib/api-test-session";
import { resolveValidationPath } from "./lib/paths";

const BASE_URL = process.env.FLORA_VALIDATION_BASE_URL ?? "http://localhost:3000";
const STRICT_HTTP = process.env.FLORA_VALIDATION_BO_ANALYZE_HTTP === "1";
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-bo-analyse-thea.md");
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 900_000;

type AnalyzeResult = {
  documentStatus?: string;
  insertedCount?: number;
  sectionsProcessed?: string[];
  competences?: Array<{ competence?: string; section?: string; niveau?: string }>;
  mode: "http" | "http+poll" | "http+progressive";
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveBoPdfPath(): string {
  const fixture = resolveValidationPath("referentiel/Programme_EVAR_elementaire-405261.pdf");
  if (fs.existsSync(fixture)) return fixture;

  const fromEnv = process.env.FLORA_VALIDATION_BO_PDF?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);

  const downloads = path.join(process.env.HOME ?? "", "Downloads");
  if (fs.existsSync(downloads)) {
    const match = fs
      .readdirSync(downloads)
      .find((name) => name.endsWith("-405261.pdf") || /405261\.pdf$/i.test(name));
    if (match) return path.join(downloads, match);
  }

  throw new Error(
    "PDF BO EVAR introuvable. Lancez scripts/generate-import-fixtures.ts ou définissez FLORA_VALIDATION_BO_PDF.",
  );
}

async function importBo(session: ApiTestSession, filePath: string) {
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new File([buffer], path.basename(filePath), { type: "application/pdf" }));

  const response = await fetch(`${session.baseUrl}/api/centre-ressources/import`, {
    method: "POST",
    headers: { Cookie: session.cookieHeader },
    body: form,
  });

  const data = (await response.json()) as {
    error?: string;
    details?: string;
    documentId?: string;
    textLength?: number;
    pageCount?: number;
    documentStatus?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || data.details || `Import HTTP ${response.status}`);
  }

  return data;
}

async function analyzeBoProgressive(session: ApiTestSession, documentId: string): Promise<AnalyzeResult> {
  let reset = true;
  let lastPayload: {
    done?: boolean;
    documentStatus?: string;
    insertedCount?: number;
    sectionsProcessed?: string[];
    progress?: number;
    error?: string;
    details?: string;
  } = {};

  for (let guard = 0; guard < 500; guard += 1) {
    const response = await fetch(`${session.baseUrl}/api/centre-ressources/analyze`, {
      method: "POST",
      headers: {
        Cookie: session.cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentId, reset }),
    });

    lastPayload = (await response.json()) as typeof lastPayload;

    if (!response.ok) {
      throw new Error(lastPayload.error || lastPayload.details || `Analyse HTTP ${response.status}`);
    }

    reset = false;

    if (lastPayload.done) {
      const { data: sampleRows } = await session.dbClient
        .from("referentiels")
        .select("competence, section, niveau")
        .eq("document_source_id", documentId)
        .order("sort_order", { ascending: true })
        .limit(120);

      return {
        documentStatus: lastPayload.documentStatus,
        insertedCount: lastPayload.insertedCount ?? 0,
        sectionsProcessed: lastPayload.sectionsProcessed ?? [],
        competences: sampleRows ?? [],
        mode: "http+progressive",
      };
    }
  }

  throw new Error("Analyse progressive interrompue (limite de ticks HTTP).");
}

async function triggerAnalyzeHttp(session: ApiTestSession, documentId: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 720_000);

  try {
    await fetch(`${session.baseUrl}/api/centre-ressources/analyze`, {
      method: "POST",
      headers: {
        Cookie: session.cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentId }),
      signal: controller.signal,
    });
  } catch {
    // Connexion coupée en dev après ~5 min alors que le serveur continue l'analyse.
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeBoHttpStrict(
  session: ApiTestSession,
  documentId: string,
): Promise<AnalyzeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 720_000);

  try {
    const response = await fetch(`${session.baseUrl}/api/centre-ressources/analyze`, {
      method: "POST",
      headers: {
        Cookie: session.cookieHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentId }),
      signal: controller.signal,
    });

    const data = (await response.json()) as {
      error?: string;
      details?: string;
      documentStatus?: string;
      insertedCount?: number;
      sectionsProcessed?: string[];
      competences?: Array<{ competence?: string; section?: string; niveau?: string }>;
    };

    if (!response.ok) {
      throw new Error(data.error || data.details || `Analyse HTTP ${response.status}`);
    }

    return { ...data, mode: "http" };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForBoAnalysis(session: ApiTestSession, documentId: string): Promise<AnalyzeResult> {
  const started = Date.now();

  while (Date.now() - started < POLL_TIMEOUT_MS) {
    const { data: document, error: docError } = await session.dbClient
      .from("bo_documents")
      .select("status, metadata, error_message")
      .eq("id", documentId)
      .maybeSingle();

    if (docError) {
      throw new Error(docError.message);
    }

    const metadata = (document?.metadata ?? {}) as Record<string, unknown>;
    const errorMessage =
      (typeof document?.error_message === "string" && document.error_message) ||
      (typeof metadata.error_message === "string" ? metadata.error_message : "");

    if (document?.status === "TEXT_EXTRACTED" && errorMessage) {
      throw new Error(`Analyse Théa échouée : ${errorMessage}`);
    }

    if (document?.status === "ERROR" && errorMessage) {
      throw new Error(`Analyse Théa échouée : ${errorMessage}`);
    }

    if (document?.status === "ANALYZED") {
      const { count, error: countError } = await session.dbClient
        .from("referentiels")
        .select("id", { count: "exact", head: true })
        .eq("document_source_id", documentId);

      if (countError) {
        throw new Error(countError.message);
      }

      const { data: sampleRows, error: sampleError } = await session.dbClient
        .from("referentiels")
        .select("competence, section, niveau")
        .eq("document_source_id", documentId)
        .order("sort_order", { ascending: true })
        .limit(120);

      if (sampleError) {
        throw new Error(sampleError.message);
      }

      const sectionsProcessed = Array.isArray(metadata.sectionsProcessed)
        ? (metadata.sectionsProcessed as string[])
        : [];

      return {
        documentStatus: document.status,
        insertedCount: count ?? 0,
        sectionsProcessed,
        competences: sampleRows ?? [],
        mode: "http+poll",
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Analyse Théa non terminée après ${POLL_TIMEOUT_MS / 1000}s (polling Supabase).`);
}

async function analyzeBo(session: ApiTestSession, documentId: string): Promise<AnalyzeResult> {
  if (STRICT_HTTP) {
    return analyzeBoHttpStrict(session, documentId);
  }

  return analyzeBoProgressive(session, documentId);
}

function writeReport(input: {
  filePath: string;
  importResult: Awaited<ReturnType<typeof importBo>>;
  analyzeResult: AnalyzeResult;
  durationMs: number;
}) {
  const sample = (input.analyzeResult.competences ?? []).slice(0, 8);

  const lines = [
    "# Validation réelle — Analyse Théa BO EVAR",
    "",
    `- Base URL : \`${BASE_URL}\``,
    `- Fichier : \`${input.filePath}\``,
    `- Date : ${new Date().toISOString()}`,
    `- Durée totale : ${input.durationMs} ms`,
    `- Mode analyse : **${input.analyzeResult.mode}**`,
    "",
    "## Import (extraction HTTP)",
    "",
    `- Document ID : ${input.importResult.documentId}`,
    `- Statut : ${input.importResult.documentStatus}`,
    `- Pages : ${input.importResult.pageCount ?? "—"}`,
    `- Caractères : ${input.importResult.textLength ?? "—"}`,
    "",
    "## Analyse Théa",
    "",
    `- Statut final : **${input.analyzeResult.documentStatus}**`,
    `- Compétences insérées : **${input.analyzeResult.insertedCount ?? 0}**`,
    `- Sections traitées : ${(input.analyzeResult.sectionsProcessed ?? []).join(", ") || "—"}`,
    "",
    "## Échantillon de compétences",
    "",
    ...sample.map(
      (item, index) =>
        `${index + 1}. [${item.section ?? "?"}${item.niveau ? ` · ${item.niveau}` : ""}] ${item.competence ?? ""}`,
    ),
    "",
  ];

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, `${lines.join("\n")}\n`);
}

async function main() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error("GEMINI_API_KEY requis pour l'analyse Théa.");
  }

  const filePath = resolveBoPdfPath();
  const started = Date.now();
  const session = await createApiTestSession(BASE_URL);

  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Fichier BO : ${path.basename(filePath)}`);
  console.log(`Mode analyse : ${STRICT_HTTP ? "HTTP strict" : "HTTP progressif (tick par bloc)"}`);

  try {
    console.log("\n→ Import + extraction (HTTP)…");
    const importResult = await importBo(session, filePath);
    if (!importResult.documentId) throw new Error("Import sans documentId.");
    console.log(
      `✓ Extraction — ${importResult.pageCount ?? "?"} pages, ${importResult.textLength ?? 0} caractères`,
    );

    console.log("\n→ Analyse Théa (API + attente résultat)…");
    const analyzeResult = await analyzeBo(session, importResult.documentId);
    const inserted = analyzeResult.insertedCount ?? 0;

    if (inserted <= 0) {
      throw new Error("Analyse Théa terminée sans compétence insérée.");
    }

    writeReport({
      filePath,
      importResult,
      analyzeResult,
      durationMs: Date.now() - started,
    });

    console.log(`✓ Analyse Théa — ${inserted} compétences, statut ${analyzeResult.documentStatus}`);
    console.log(`  Sections : ${(analyzeResult.sectionsProcessed ?? []).join(", ")}`);
    console.log(`Rapport : ${REPORT_OUT}`);
    console.log("\nTest BO analyse Théa : SUCCÈS");
  } finally {
    await cleanupApiTestSession(session);
  }
}

main().catch((error) => {
  console.error("\nTest BO analyse Théa : ÉCHEC", error instanceof Error ? error.message : error);
  process.exit(1);
});
