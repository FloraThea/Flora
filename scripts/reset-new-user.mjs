#!/usr/bin/env node
/**
 * Remet Flora en état « nouvel utilisateur » : supprime toutes les données applicatives.
 * Usage: node scripts/reset-new-user.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.");
  process.exit(1);
}

const supabase = createClient(url, key);

/** Ordre respectant les clés étrangères (enfants d'abord). */
const TABLES = [
  "journal_exports",
  "journal_adjustments",
  "journal_observations",
  "journal_entries",
  "journals",
  "seance_activities",
  "seance_edit_history",
  "seance_phases",
  "seances",
  "sequence_evaluations",
  "sequence_sessions",
  "sequences",
  "progression_rows",
  "progression_tabs",
  "progressions",
  "programming_cells",
  "programming_periods",
  "programming_tables",
  "programmations",
  "referentiels",
  "bo_documents",
  "document_competences",
  "document_tags",
  "document_chunks",
  "document_relations",
  "documents",
  "pedagogical_relations",
  "bo_competence_links",
  "knowledge_index",
  "pedagogical_entities",
  "teacher_projects",
  "teacher_methods",
  "teacher_preferences",
  "teacher_profiles",
];

async function clearTable(table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .not("id", "is", null);

  if (error) {
    if (error.code === "42P01") {
      console.warn(`  ⊘ ${table} — table absente, ignorée`);
      return 0;
    }
    throw new Error(`${table}: ${error.message}`);
  }

  return count ?? 0;
}

async function main() {
  console.info("Réinitialisation Flora — mode nouvel utilisateur\n");

  let total = 0;

  for (const table of TABLES) {
    try {
      const deleted = await clearTable(table);
      console.info(`  ✓ ${table} — ${deleted} ligne(s) supprimée(s)`);
      total += deleted;
    } catch (error) {
      console.error(`  ✗ ${table} — ${error.message}`);
    }
  }

  console.info(`\nTerminé. ${total} ligne(s) supprimée(s) au total.`);
  console.info("Au prochain chargement, Flora créera un profil enseignant vierge (draft).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
