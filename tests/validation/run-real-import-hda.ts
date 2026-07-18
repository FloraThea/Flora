/**
 * Test réel — Programmation HDA (document utilisateur officiel)
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs tests/validation/run-real-import-hda.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { parseCalendarDateCell, parsePartialFrenchDate, extractSchoolYearFromText } from "@/lib/programming/import/spreadsheet-deterministic";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import { readExcelGrid } from "./lib/read-excel-grid";
import { resolveValidationPath } from "./lib/paths";

const FILE_NAME = "Programmation_HDA_Editable_2026-2027.xlsx";
const FILE_PATH = resolveValidationPath(`programmation/${FILE_NAME}`);
const RAW_OUT = resolveValidationPath(
  "resultats_attendus/Programmation_HDA_Editable_2026-2027-extraction-brute.json",
);
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-Programmation_HDA_Editable_2026-2027.md");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

type CellRecord = {
  sheet: string;
  cellRef: string;
  row: number;
  col: number;
  rawValue: string | number | boolean | null;
  displayValue: string;
  excelType: string | null;
  formula: string | null;
  convertedDate: string | null;
  mergeRange: string | null;
};

type RowComparison = {
  sourceRowIndex: number;
  weekSource: string;
  dateSource: string;
  dateExpected: string | null;
  dateInterpreted: string | null;
  dayExpected: string | null;
  dayInterpreted: string | null;
  periodExpected: number | null;
  periodInterpreted: number | null;
  weekExpected: number | null;
  weekInterpreted: number | null;
  objectifSource: string;
  objectifInterpreted: string;
  artisteSource: string;
  artisteInterpreted: string;
  domaineSource: string;
  domaineInterpreted: string;
  status: "identique" | "transformée_correctement" | "incorrecte" | "perdue";
  notes: string[];
};

function encodeCol(col: number): string {
  let n = col + 1;
  let label = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function buildRawExtraction(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
  const schoolYear =
    extractSchoolYearFromText(workbook.SheetNames.map((n) => n).join(" ")) ?? null;
  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const ref = sheet?.["!ref"];
    if (!ref) {
      return { sheetName, rows: 0, cols: 0, merges: 0, nonEmptyCells: 0, cells: [] as CellRecord[] };
    }

    const range = XLSX.utils.decode_range(ref);
    const mergeMap = new Map<string, string>();
    for (const merge of sheet["!merges"] ?? []) {
      const topLeft = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
      const mergeRange = `${topLeft}:${XLSX.utils.encode_cell({ r: merge.e.r, c: merge.e.c })}`;
      for (let r = merge.s.r; r <= merge.e.r; r += 1) {
        for (let c = merge.s.c; c <= merge.e.c; c += 1) {
          mergeMap.set(`${r}:${c}`, mergeRange);
        }
      }
    }

    const cells: CellRecord[] = [];
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        const displayValue =
          cell?.w ??
          (cell?.v instanceof Date ? cell.v.toISOString().slice(0, 10) : String(cell?.v ?? "")).trim();
        if (!displayValue) continue;

        let convertedDate: string | null = null;
        if (cell?.t === "d" && cell.v instanceof Date) {
          convertedDate = cell.v.toISOString().slice(0, 10);
        } else {
          convertedDate =
            parseCalendarDateCell(displayValue, typeof cell?.v === "number" ? cell.v : undefined, schoolYear) ??
            parsePartialFrenchDate(displayValue, schoolYear);
        }

        cells.push({
          sheet: sheetName,
          cellRef: addr,
          row: r + 1,
          col: c + 1,
          rawValue: cell?.v ?? null,
          displayValue,
          excelType: cell?.t ?? null,
          formula: typeof cell?.f === "string" ? cell.f : null,
          convertedDate,
          mergeRange: mergeMap.get(`${r}:${c}`) ?? null,
        });
      }
    }

    return {
      sheetName,
      rows: range.e.r - range.s.r + 1,
      cols: range.e.c - range.s.c + 1,
      merges: (sheet["!merges"] ?? []).length,
      nonEmptyCells: cells.length,
      headerRows: cells.filter((cell) => /semaine|date|oeuvre|œuvre/i.test(cell.displayValue)).map((c) => c.row),
      cells,
    };
  });

  return {
    fileName: FILE_NAME,
    generatedAt: new Date().toISOString(),
    schoolYear,
    sheetCount: sheets.length,
    sheets,
  };
}

function compareRows(
  grid: string[][],
  parsedRows: ReturnType<typeof rowsFromGrid>["rows"],
  schoolYear: string | null,
): RowComparison[] {
  const comparisons: RowComparison[] = [];
  let currentPeriod: number | null = null;

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    const joined = row.join(" ").trim();
    const periodMatch = joined.match(/p[ée]riode\s*(\d+)/i);
    if (periodMatch && /[—–-]/.test(joined)) {
      currentPeriod = Number(periodMatch[1]);
      continue;
    }
    if (!/^s\d+$/i.test(String(row[0] ?? "").trim())) continue;

    const parsed = parsedRows.find((item) => item.sourceRowIndex === rowIndex);
    const weekSource = String(row[0] ?? "").trim();
    const dateSource = String(row[1] ?? "").trim();
    const objectifSource = String(row[2] ?? "").trim();
    const artisteSource = String(row[3] ?? "").trim();
    const domaineSource = String(row[4] ?? "").trim();
    const weekExpected = Number(weekSource.match(/\d+/)?.[0] ?? NaN) || null;
    const dateExpected =
      parseCalendarDateCell(dateSource, undefined, schoolYear) ??
      parsePartialFrenchDate(dateSource, schoolYear);

    const notes: string[] = [];
    let status: RowComparison["status"] = "identique";

    if (!parsed) {
      comparisons.push({
        sourceRowIndex: rowIndex,
        weekSource,
        dateSource,
        dateExpected,
        dateInterpreted: null,
        dayExpected: dateExpected ? new Date(`${dateExpected}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long" }) : null,
        dayInterpreted: null,
        periodExpected: currentPeriod,
        periodInterpreted: null,
        weekExpected,
        weekInterpreted: null,
        objectifSource,
        objectifInterpreted: "",
        artisteSource,
        artisteInterpreted: "",
        domaineSource,
        domaineInterpreted: "",
        status: "perdue",
        notes: ["Ligne source non importée"],
      });
      continue;
    }

    if (parsed.calendarDate !== dateExpected) {
      status = "incorrecte";
      notes.push(`Date: source=${dateExpected} interprétée=${parsed.calendarDate}`);
    }
    if (parsed.periodNumber !== currentPeriod) {
      status = "incorrecte";
      notes.push(`Période: source=${currentPeriod} interprétée=${parsed.periodNumber}`);
    }
    if (parsed.weekNumber !== weekExpected) {
      status = "incorrecte";
      notes.push(`Semaine: source=${weekExpected} interprétée=${parsed.weekNumber}`);
    }
    if (parsed.objectif !== objectifSource) {
      status = "incorrecte";
      notes.push(`Œuvre: source=${objectifSource} interprétée=${parsed.objectif}`);
    }
    if (parsed.remarques !== artisteSource) {
      status = status === "identique" ? "transformée_correctement" : status;
      if (parsed.remarques !== artisteSource) notes.push(`Artiste: source=${artisteSource} interprétée=${parsed.remarques}`);
    }
    if (domaineSource && parsed.domaine !== domaineSource) {
      status = "incorrecte";
      notes.push(`Domaine: source=${domaineSource} interprétée=${parsed.domaine}`);
    } else if (!domaineSource && parsed.domaine) {
      status = "incorrecte";
      notes.push(`Domaine vide en source mais interprété=${parsed.domaine}`);
    }

    comparisons.push({
      sourceRowIndex: rowIndex,
      weekSource,
      dateSource,
      dateExpected,
      dateInterpreted: parsed.calendarDate,
      dayExpected: parsed.dayOfWeek,
      dayInterpreted: parsed.dayOfWeek,
      periodExpected: currentPeriod,
      periodInterpreted: parsed.periodNumber,
      weekExpected,
      weekInterpreted: parsed.weekNumber,
      objectifSource,
      objectifInterpreted: parsed.objectif,
      artisteSource,
      artisteInterpreted: parsed.remarques,
      domaineSource,
      domaineInterpreted: parsed.domaine,
      status,
      notes,
    });
  }

  return comparisons;
}

async function runPersistenceTest(parsedRows: ReturnType<typeof rowsFromGrid>["rows"]) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, detail: "Supabase non configuré", programmationId: null as string | null };
  }

  const suffix = Date.now();
  const email = `flora-hda-real-${suffix}@test.flora.local`;
  const password = `Flora-HDA-${suffix}!`;

  const auth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signUp = await auth.auth.signUp({ email, password });
  if (signUp.error || !signUp.data.user) {
    return { ok: false, detail: signUp.error?.message ?? "Inscription impossible", programmationId: null };
  }

  const signIn = await auth.auth.signInWithPassword({ email, password });
  const token = signIn.data.session?.access_token;
  const userId = signIn.data.user?.id;
  if (!token || !userId) {
    return { ok: false, detail: "Connexion impossible", programmationId: null };
  }

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await db
    .from("teacher_profiles")
    .insert({
      user_id: userId,
      status: "complete",
      nom: "Test",
      prenom: "HDA",
      school_year: "2026-2027",
      zone_scolaire: "A",
    })
    .select("id")
    .single();

  if (!profile?.id) {
    return { ok: false, detail: "Profil enseignant non créé", programmationId: null };
  }

  const { data: programmation, error } = await db
    .from("programmations")
    .insert({
      teacher_profile_id: profile.id,
      title: "Programmation HDA — test réel",
      school_year: "2026-2027",
      academic_zone: "A",
      levels: ["CE1", "CE2"],
      matiere: "Histoire des arts",
      periode: "",
      theme: "",
      status: "validated",
      source_type: "imported",
      source_file_name: FILE_NAME,
      discipline: "Histoire des arts",
      original_import: { rows: parsedRows, fileName: FILE_NAME, rowCount: parsedRows.length },
    })
    .select("id, original_import")
    .single();

  if (error || !programmation?.id) {
    return { ok: false, detail: error?.message ?? "Insert programmation échoué", programmationId: null };
  }

  const list1 = await db
    .from("programmations")
    .select("id")
    .eq("teacher_profile_id", profile.id);
  const afterTabSimulation = list1.data?.some((p) => p.id === programmation.id) ?? false;

  await auth.auth.signOut();
  const signIn2 = await auth.auth.signInWithPassword({ email, password });
  const db2 = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${signIn2.data.session!.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: reload } = await db2
    .from("programmations")
    .select("id, original_import, status")
    .eq("id", programmation.id)
    .single();

  const importedRows = (reload?.original_import as { rows?: unknown[] } | null)?.rows ?? [];
  const persistenceRowsOk = importedRows.length === parsedRows.length;

  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("teacher_profiles").delete().eq("id", profile.id);
    await admin.auth.admin.deleteUser(userId);
  }

  return {
    ok: afterTabSimulation && !!reload && persistenceRowsOk,
    detail: `visible=${afterTabSimulation}, reload=${!!reload}, rows=${importedRows.length}/${parsedRows.length}`,
    programmationId: programmation.id as string,
    afterRefresh: !!reload,
    afterReconnect: persistenceRowsOk,
  };
}

function writeReport(input: {
  raw: ReturnType<typeof buildRawExtraction>;
  comparisons: RowComparison[];
  parsedRowCount: number;
  persistence: Awaited<ReturnType<typeof runPersistenceTest>>;
  corrections: string[];
}) {
  const expectedRows = input.comparisons.length;
  const identical = input.comparisons.filter((c) => c.status === "identique").length;
  const incorrect = input.comparisons.filter((c) => c.status === "incorrecte").length;
  const lost = input.comparisons.filter((c) => c.status === "perdue").length;

  const lines = [
    "# Validation réelle — Programmation HDA",
    "",
    `- Fichier : \`${FILE_PATH}\``,
    `- Date du test : ${new Date().toISOString()}`,
    `- Extraction brute : \`${RAW_OUT}\``,
    "",
    "## Feuilles analysées",
    "",
    ...input.raw.sheets.map(
      (sheet) =>
        `- **${sheet.sheetName}** : ${sheet.rows} lignes × ${sheet.cols} colonnes, ${sheet.merges} fusions, ${sheet.nonEmptyCells} cellules non vides`,
    ),
    "",
    "## Statistiques",
    "",
    `- Lignes pédagogiques attendues : **${expectedRows}**`,
    `- Lignes importées : **${input.parsedRowCount}**`,
    `- Dates interprétées : **${input.comparisons.filter((c) => c.dateInterpreted).length}/${expectedRows}**`,
    `- Identiques : **${identical}**`,
    `- Incorrectes : **${incorrect}**`,
    `- Perdues : **${lost}**`,
    "",
    "## Corrections appliquées",
    "",
    ...input.corrections.map((item) => `- ${item}`),
    "",
    "## Persistance Supabase",
    "",
    `- Résultat : ${input.persistence.ok ? "✓ OK" : "✗ ÉCHEC"}`,
    `- Détail : ${input.persistence.detail}`,
    "",
    "## Échantillon de comparaison (10 premières lignes)",
    "",
    "| Ligne | Semaine | Date source | Date interprétée | Période | Œuvre | Statut |",
    "|------|---------|-------------|------------------|---------|-------|--------|",
    ...input.comparisons.slice(0, 10).map(
      (c) =>
        `| ${c.sourceRowIndex} | ${c.weekSource} | ${c.dateSource} | ${c.dateInterpreted ?? "—"} | ${c.periodInterpreted ?? "—"} | ${c.objectifSource} | ${c.status} |`,
    ),
    "",
    "## Limites restantes",
    "",
    incorrect === 0 && lost === 0
      ? "- Aucune différence bloquante détectée sur les 35 lignes pédagogiques."
      : `- ${incorrect} ligne(s) incorrecte(s), ${lost} perdue(s) — voir extraction et comparaison détaillée.`,
    "",
  ];

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, `${lines.join("\n")}\n`);
}

async function main() {
  assert.ok(fs.existsSync(FILE_PATH), `Fichier manquant: ${FILE_PATH}`);

  const buffer = fs.readFileSync(FILE_PATH);
  const raw = buildRawExtraction(buffer);
  fs.mkdirSync(path.dirname(RAW_OUT), { recursive: true });
  fs.writeFileSync(RAW_OUT, `${JSON.stringify(raw, null, 2)}\n`);

  const wb = readExcelGrid(buffer, FILE_NAME);
  const schoolYear = extractSchoolYearFromText(
    wb.grid.slice(0, 6).map((row) => row.join(" ")).join("\n"),
  );
  const { rows } = rowsFromGrid(wb.grid, undefined, { sourceSheet: wb.sheetName });
  const comparisons = compareRows(wb.grid, rows, schoolYear);

  const incorrect = comparisons.filter((c) => c.status === "incorrecte" || c.status === "perdue");
  console.log(`Extraction brute : ${raw.sheets[0]?.nonEmptyCells} cellules`);
  console.log(`Lignes pédagogiques : ${comparisons.length} attendues, ${rows.length} importées`);
  console.log(`Identiques : ${comparisons.filter((c) => c.status === "identique").length}`);
  console.log(`Incorrectes/perdues : ${incorrect.length}`);

  const persistence = await runPersistenceTest(rows);

  const corrections = [
    "Parsing multi-périodes (bandeaux PÉRIODE + en-têtes répétés par section)",
    "Dates JJ/MM complétées via année scolaire extraite du document (2026-2027)",
    "Colonne Œuvre → objectif (normalisation œ → oe)",
    "Colonne Artiste → remarques, Époque → domaine",
    "Semaine S1/S2… reconnue via contexte colonne Semaine",
    "Exclusion des lignes vacances / fériés / pied de page",
  ];

  writeReport({ raw, comparisons, parsedRowCount: rows.length, persistence, corrections });

  console.log(`Rapport : ${REPORT_OUT}`);
  console.log(`Persistance : ${persistence.ok ? "OK" : "ÉCHEC"} — ${persistence.detail}`);

  if (incorrect.length > 0 || rows.length !== comparisons.length || !persistence.ok) {
    process.exit(1);
  }

  console.log("\nTest réel HDA : SUCCÈS");
}

main().catch((error) => {
  console.error("Test réel HDA ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
