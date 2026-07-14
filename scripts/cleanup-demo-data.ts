/**
 * Rapport et nettoyage prudent des données demo / orphelines en base.
 *
 * Usage :
 *   npx tsx scripts/cleanup-demo-data.ts          # rapport uniquement
 *   npx tsx scripts/cleanup-demo-data.ts --execute # suppression confirmée
 */

import { createClient } from "@supabase/supabase-js";
import { isDemoMetadata } from "../lib/journal/journal-entry-utils";

type DemoCandidate = {
  table: string;
  id: string;
  reason: string;
};

const EXECUTE = process.argv.includes("--execute");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error("Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function scanTable(table: string): Promise<DemoCandidate[]> {

  const { data, error } = await supabase.from(table).select("id, teacher_profile_id, metadata");
  if (error) {
    console.warn(`[scan] ${table}: ${error.message}`);
    return [];
  }

  const candidates: DemoCandidate[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const id = String(row.id);
    const profileId = row.teacher_profile_id;
    const metadata = row.metadata;

    if (profileId == null || profileId === "") {
      candidates.push({ table, id, reason: "teacher_profile_id absent" });
      continue;
    }

    if (isDemoMetadata(metadata)) {
      candidates.push({ table, id, reason: "metadata demo/seed explicite" });
    }
  }

  return candidates;
}

async function scanJournals(): Promise<DemoCandidate[]> {
  const { data, error } = await supabase
    .from("journals")
    .select("id, teacher_profile_id, metadata, class_name, journal_date");

  if (error) {
    console.warn(`[scan] journals: ${error.message}`);
    return [];
  }

  const candidates: DemoCandidate[] = [];
  for (const row of data ?? []) {
    const id = String(row.id);
    if (!row.teacher_profile_id) {
      candidates.push({ table: "journals", id, reason: "teacher_profile_id absent" });
      continue;
    }
    if (isDemoMetadata(row.metadata)) {
      candidates.push({ table: "journals", id, reason: "metadata demo/seed explicite" });
      continue;
    }
    const className = String(row.class_name ?? "").toLowerCase();
    if (className.includes("demo") || className.includes("exemple") || className.includes("test")) {
      candidates.push({
        table: "journals",
        id,
        reason: `nom de classe suspect (${row.class_name})`,
      });
    }
  }

  return candidates;
}

async function deleteCandidates(candidates: DemoCandidate[]): Promise<void> {
  const journalIds = candidates.filter((item) => item.table === "journals").map((item) => item.id);

  if (journalIds.length > 0) {
    const { data: entryRows } = await supabase
      .from("journal_entries")
      .select("id")
      .in("journal_id", journalIds);
    const entryIds = (entryRows ?? []).map((row) => String(row.id));

    if (entryIds.length > 0) {
      await supabase.from("journal_observations").delete().in("journal_entry_id", entryIds);
      await supabase.from("journal_entries").delete().in("journal_id", journalIds);
      await supabase.from("journal_adjustments").delete().in("journal_id", journalIds);
      await supabase.from("journal_exports").delete().in("journal_id", journalIds);
    }

    await supabase.from("journals").delete().in("id", journalIds);
  }

  const grouped = new Map<string, string[]>();
  for (const candidate of candidates) {
    if (candidate.table === "journals") continue;
    const ids = grouped.get(candidate.table) ?? [];
    ids.push(candidate.id);
    grouped.set(candidate.table, ids);
  }

  for (const [table, ids] of grouped) {
    if (ids.length === 0) continue;
    await supabase.from(table).delete().in("id", ids);
  }
}

async function main() {
  console.log(`Flora — nettoyage données demo (${EXECUTE ? "EXECUTION" : "rapport"})`);
  console.log("—".repeat(60));

  const tables = [
    "agenda_events",
    "agenda_tasks",
    "agenda_reminders",
    "teacher_108h_entries",
    "teacher_108h_summary",
  ] as const;

  const candidates: DemoCandidate[] = [];
  for (const table of tables) {
    candidates.push(...(await scanTable(table)));
  }
  candidates.push(...(await scanJournals()));

  if (candidates.length === 0) {
    console.log("Aucune donnée demo identifiable automatiquement.");
    return;
  }

  const byTable = new Map<string, DemoCandidate[]>();
  for (const candidate of candidates) {
    const list = byTable.get(candidate.table) ?? [];
    list.push(candidate);
    byTable.set(candidate.table, list);
  }

  for (const [table, rows] of byTable) {
    console.log(`\n${table} (${rows.length})`);
    for (const row of rows.slice(0, 20)) {
      console.log(`  · ${row.id} — ${row.reason}`);
    }
    if (rows.length > 20) {
      console.log(`  … et ${rows.length - 20} autre(s)`);
    }
  }

  console.log(`\nTotal : ${candidates.length} enregistrement(s) candidat(s).`);

  if (!EXECUTE) {
    console.log("\nAucune suppression effectuée. Relancez avec --execute pour appliquer.");
    return;
  }

  await deleteCandidates(candidates);
  console.log("\nSuppression terminée.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
