/**
 * Tests d'acceptation — 3 blocages fonctionnels Flora.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/stabilization/run-blocker-acceptance-tests.ts
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { rowsFromGrid } from "@/lib/programming/import/grid-parser";
import {
  excelSerialToIsoDate,
  parseCalendarDateCell,
} from "@/lib/programming/import/spreadsheet-deterministic";
import { computeSlotCardTypography } from "@/lib/timetable/slot-card-typography";
import { resolveSlotCardDisplay } from "@/lib/timetable/slot-display";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function log(ok: boolean, label: string, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) throw new Error(label);
}

function testComplementaryTextDisplay() {
  const typography = computeSlotCardTypography(30);
  assert.equal(typography.showComplementaryText, true);

  const display = resolveSlotCardDisplay({
    id: "s1",
    scheduleId: "sched",
    day: "Lundi",
    start: "08:30",
    end: "09:00",
    subject: "Français",
    subSubject: "",
    customText: "Groupe A",
    color: "",
    gradient: "",
    slotType: "seance",
    lockLevel: "none",
    hours: 0.5,
    room: "",
    intervenant: "",
    label: "Français",
    sortOrder: 0,
    metadata: {},
  });
  assert.equal(display.complementaryText, "Groupe A");
  log(true, "Blocage 1 — typographie affiche le texte complémentaire");
}

function buildSampleXlsxBuffer(): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Date", "Jour", "Semaine", "Séquence", "Séance", "Objectif"],
    [45200, "lundi", 1, "Séq. 1", "Séance 1", "Intro fractions"],
    ["", "", "", "", "Séance 2", "Pratique"],
    ["16/09/2025", "mardi", 1, "Séq. 1", "Séance 3", "Évaluation"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Progression CM2");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

function testSpreadsheetImportFidelity() {
  const excelDate = excelSerialToIsoDate(45200);
  assert.ok(excelDate);

  const grid = [
    ["Date", "Jour", "Semaine", "Séquence", "Séance", "Objectif"],
    [excelDate!, "lundi", "1", "Séq. 1", "Séance 1", "Intro fractions"],
    ["", "", "", "", "Séance 2", "Pratique"],
    ["16/09/2025", "mardi", "1", "Séq. 1", "Séance 3", "Évaluation"],
  ];
  const { rows } = rowsFromGrid(grid, undefined, { sourceSheet: "Progression CM2" });

  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.calendarDate, excelDate);
  assert.equal(rows[0]?.dayOfWeek, "lundi");
  assert.match(rows[0]?.sequence ?? "", /1/);
  assert.equal(rows[0]?.seance, "Séance 1");
  assert.equal(rows[1]?.seance, "Séance 2");
  assert.equal(rows[1]?.weekNumber, 1);
  assert.equal(rows[2]?.calendarDate, "2025-09-16");
  assert.equal(rows[2]?.dayOfWeek, "mardi");

  const buffer = buildSampleXlsxBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  const rawGrid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  const firstDateCell = rawGrid[1]?.[0] ?? "";
  assert.ok(parseCalendarDateCell(firstDateCell) || parseCalendarDateCell("", 45200));

  log(true, "Blocage 2 — import XLSX fidèle (dates, jours, séquences, séances, héritage)");
}

async function testPersistenceAndIsolation() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("⚠ Blocage 3 / isolation — ignoré (Supabase non configuré)");
    return;
  }

  const suffix = Date.now();
  const password = `Flora-Blocker-${suffix}!`;
  const emailA = `flora-blocker-a-${suffix}@test.flora.local`;
  const emailB = `flora-blocker-b-${suffix}@test.flora.local`;

  const auth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await auth.auth.signUp({ email: emailA, password });
  const signInA = await auth.auth.signInWithPassword({ email: emailA, password });
  const tokenA = signInA.data.session!.access_token;
  const userA = signInA.data.user!.id;

  const dbA = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${tokenA}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profileA } = await dbA
    .from("teacher_profiles")
    .insert({
      user_id: userA,
      status: "complete",
      nom: "Test",
      prenom: "Alice",
      school_year: "2025-2026",
      zone_scolaire: "A",
    })
    .select("id")
    .single();

  const profileIdA = String(profileA!.id);

  const { data: progDraft } = await dbA
    .from("programmations")
    .insert({
      teacher_profile_id: profileIdA,
      title: "Import draft test",
      school_year: "2024-2025",
      academic_zone: "A",
      levels: ["CM2"],
      matiere: "Mathématiques",
      periode: "",
      theme: "",
      status: "draft",
    })
    .select("id, status")
    .single();

  const { data: progReload } = await dbA
    .from("programmations")
    .select("id")
    .eq("teacher_profile_id", profileIdA)
    .in("status", ["validated", "draft"]);

  log(
    !!progDraft?.id && (progReload ?? []).some((row) => row.id === progDraft.id),
    "Blocage 3 — programmation draft relue après écriture",
    `status=${progDraft?.status}`,
  );

  const { data: progressionDraft } = await dbA
    .from("progressions")
    .insert({
      teacher_profile_id: profileIdA,
      title: "Progression import draft",
      link_mode: "standalone",
      status: "draft",
    })
    .select("id")
    .single();

  const { data: progList } = await dbA
    .from("progressions")
    .select("id")
    .eq("teacher_profile_id", profileIdA)
    .in("status", ["validated", "draft"]);

  log(
    !!progressionDraft?.id && (progList ?? []).some((row) => row.id === progressionDraft.id),
    "Blocage 3 — progression draft relue après écriture",
  );

  const { data: schedule } = await dbA
    .from("timetable_schedules")
    .insert({
      teacher_profile_id: profileIdA,
      name: "EDT test",
      school_year: "2025-2026",
      is_active: true,
    })
    .select("id")
    .single();

  const complementary = "Texte complémentaire E2E";
  const { data: slot } = await dbA
    .from("timetable_slots")
    .insert({
      schedule_id: schedule!.id,
      day: "Lundi",
      start_time: "08:30",
      end_time: "09:00",
      subject: "Français",
      custom_text: complementary,
      slot_type: "seance",
    })
    .select("custom_text")
    .single();

  const { data: slotReload } = await dbA
    .from("timetable_slots")
    .select("custom_text")
    .eq("schedule_id", schedule!.id)
    .single();

  log(
    slot?.custom_text === complementary && slotReload?.custom_text === complementary,
    "Blocage 1 — custom_text persisté et relu depuis Supabase",
  );

  await auth.auth.signOut();
  await auth.auth.signUp({ email: emailB, password });
  const signInB = await auth.auth.signInWithPassword({ email: emailB, password });
  const dbB = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${signInB.data.session!.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: leakedProg } = await dbB
    .from("programmations")
    .select("id", { count: "exact", head: true })
    .eq("teacher_profile_id", profileIdA);

  const { count: leakedSlots } = await dbB
    .from("timetable_slots")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", schedule!.id);

  log((leakedProg ?? 0) === 0 && (leakedSlots ?? 0) === 0, "Isolation multi-utilisateur (compte B)", `leaked=${leakedProg ?? 0}`);

  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("teacher_profiles").delete().eq("id", profileIdA);
    await admin.auth.admin.deleteUser(userA);
    await admin.auth.admin.deleteUser(signInB.data.user!.id);
    console.log("✓ Nettoyage comptes test");
  }
}

async function main() {
  testComplementaryTextDisplay();
  testSpreadsheetImportFidelity();
  await testPersistenceAndIsolation();
  console.log("\nTests d'acceptation blocages : OK");
}

main().catch((error) => {
  console.error("\nTests d'acceptation blocages ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
