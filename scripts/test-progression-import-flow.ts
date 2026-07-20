/**
 * Test réel : import progression → sauvegarde → affichage → corbeille → réimport
 * Vérifie que la colonne matiere (PGRST204) est reconnue par PostgREST.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/test-progression-import-flow.ts
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { rowsFromGrid } from "../lib/programming/import/grid-parser";
import { readExcelGrid } from "../tests/validation/lib/read-excel-grid";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const databaseUrl = process.env.SUPABASE_DATABASE_URL?.trim();

async function cleanupWithPg(profileId: string, userId: string) {
  if (!databaseUrl) return;
  const pg = await import("pg");
  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("delete from public.progressions where teacher_profile_id = $1", [profileId]);
    await client.query("delete from public.teacher_profiles where id = $1", [profileId]);
    await client.query("delete from auth.users where id = $1", [userId]);
  } finally {
    await client.end();
  }
}

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY manquants dans .env.local");
  }

  const suffix = Date.now();
  const email = `flora-progression-flow-${suffix}@test.flora.local`;
  const password = `Flora-flow-${suffix}!`;

  const auth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signUp = await auth.auth.signUp({ email, password });
  if (signUp.error || !signUp.data.user) {
    throw new Error(signUp.error?.message ?? "Inscription impossible");
  }

  const signIn = await auth.auth.signInWithPassword({ email, password });
  const token = signIn.data.session?.access_token;
  const userId = signIn.data.user?.id;
  if (!token || !userId) throw new Error("Connexion impossible");

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const admin = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  void admin;

  const { data: profile, error: profileError } = await db
    .from("teacher_profiles")
    .insert({
      user_id: userId,
      status: "complete",
      nom: "Test",
      prenom: "Import",
      school_year: "2026-2027",
      zone_scolaire: "A",
    })
    .select("id")
    .single();

  if (profileError || !profile?.id) {
    throw new Error(profileError?.message ?? "Profil non créé");
  }

  const filePath = path.resolve(
    process.cwd(),
    "tests/validation/progression/Progression_EMC_Editable_2026-2027.xlsx",
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier test absent : ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const wb = readExcelGrid(buffer, path.basename(filePath));
  const { rows } = rowsFromGrid(wb.grid, undefined, { sourceSheet: wb.sheetName });

  console.log("[1/5] Insert progression avec matiere=EMC (PostgREST)…");
  const { data: progression, error: insertError } = await db
    .from("progressions")
    .insert({
      teacher_profile_id: profile.id,
      programmation_id: null,
      title: `Progression EMC test ${suffix}`,
      methode: "",
      validation: { valid: true, errors: [], warnings: [] },
      calendar_snapshot: {},
      status: "validated",
      link_mode: "independent",
      matiere: "EMC",
      sous_matiere: "",
      niveau: "CM2",
      periode: "",
      source_document: {},
      metadata: {
        source_type: "imported",
        source_file_name: path.basename(filePath),
        original_import: { rows, rowCount: rows.length },
      },
    })
    .select("id, matiere, niveau, status")
    .single();

  if (insertError) {
    throw new Error(`Insert échoué (PGRST204?) : ${insertError.message}`);
  }
  if (!progression?.id) throw new Error("Progression non créée");
  console.log(`  → id=${progression.id}, matiere=${progression.matiere}`);

  console.log("[2/5] Onglet progression_tabs…");
  const { error: tabError } = await db.from("progression_tabs").insert({
    progression_id: progression.id,
    subject_key: "emc",
    subject_label: "EMC",
    sub_subject_label: "",
    sort_order: 0,
    accent: "sage",
  });
  if (tabError) throw new Error(`Onglet : ${tabError.message}`);
  console.log("  → onglet EMC créé");

  console.log("[3/5] Affichage liste active (deleted_at is null)…");
  const { data: list, error: listError } = await db
    .from("progressions")
    .select("id, title, matiere")
    .eq("teacher_profile_id", profile.id)
    .is("deleted_at", null);

  if (listError) throw new Error(listError.message);
  if (!list?.some((item) => item.id === progression.id)) {
    throw new Error("Progression absente de la liste active");
  }
  console.log(`  → ${list.length} progression(s) visible(s)`);

  console.log("[4/5] Corbeille (soft delete)…");
  const purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error: trashError } = await db
    .from("progressions")
    .update({
      deleted_at: new Date().toISOString(),
      deletion_reason: "Test import flow",
      purge_after: purgeAfter,
    })
    .eq("id", progression.id);

  if (trashError) throw new Error(trashError.message);

  const { data: activeAfterTrash } = await db
    .from("progressions")
    .select("id")
    .eq("id", progression.id)
    .is("deleted_at", null);
  if (activeAfterTrash?.length) {
    throw new Error("Progression encore visible après corbeille");
  }
  console.log("  → corbeille OK");

  console.log("[5/5] Réimport…");
  const { data: reimport, error: reimportError } = await db
    .from("progressions")
    .insert({
      teacher_profile_id: profile.id,
      programmation_id: null,
      title: `Progression EMC réimport ${suffix}`,
      methode: "",
      validation: { valid: true, errors: [], warnings: [] },
      calendar_snapshot: {},
      status: "validated",
      link_mode: "independent",
      matiere: "EMC",
      sous_matiere: "",
      niveau: "CM2",
      periode: "",
      metadata: {
        source_type: "imported",
        source_file_name: path.basename(filePath),
        original_import: { rows, rowCount: rows.length },
      },
    })
    .select("id, matiere")
    .single();

  if (reimportError) throw new Error(`Réimport : ${reimportError.message}`);
  console.log(`  → réimport OK : ${reimport?.id}`);

  await cleanupWithPg(String(profile.id), userId);

  console.log("\nTest progression import flow : SUCCÈS");
}

main().catch((error) => {
  console.error("\nTest progression import flow : ÉCHEC");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
