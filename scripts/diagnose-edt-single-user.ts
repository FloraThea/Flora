/**
 * Diagnostic mono-utilisateur EDT — sans cookie auth (comme l'app réelle).
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/diagnose-edt-single-user.ts
 */
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.FLORA_VALIDATION_BASE_URL?.trim() || "http://localhost:3001";
const FILE_PATH = path.resolve(
  process.cwd(),
  "tests/validation/emploi_du_temps/emploi_du_temps_rentree.xlsx",
);

async function fetchJson(url: string, init?: RequestInit) {
  const started = Date.now();
  const response = await fetch(url, init);
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { response, data, ms: Date.now() - started };
}

async function main() {
  console.log(`\n=== Diagnostic EDT mono-utilisateur ===`);
  console.log(`Base URL : ${BASE_URL}`);
  console.log(`Auth cookie : aucun (mode app réelle)\n`);

  const profilBefore = await fetchJson(`${BASE_URL}/api/profil`);
  console.log(`GET /api/profil (${profilBefore.ms}ms) → HTTP ${profilBefore.response.status}`);
  const completionBefore = profilBefore.data.completion as { complete?: boolean; missing?: string[] } | undefined;
  console.log(`  Profil complet : ${completionBefore?.complete ? "oui" : "non"}`);
  console.log(`  Manquant : ${completionBefore?.missing?.join(", ") || "aucun"}`);

  const edtBefore = await fetchJson(`${BASE_URL}/api/emploi-du-temps`);
  console.log(`\nGET /api/emploi-du-temps (${edtBefore.ms}ms) → HTTP ${edtBefore.response.status}`);
  const slotsBefore = (edtBefore.data.slots as unknown[] | undefined)?.length ?? 0;
  const scheduleBefore = edtBefore.data.schedule as { id?: string; teacherProfileId?: string | null } | undefined;
  console.log(`  schedule_id : ${scheduleBefore?.id ?? "—"}`);
  console.log(`  teacher_profile_id : ${scheduleBefore?.teacherProfileId ?? "null"}`);
  console.log(`  créneaux : ${slotsBefore}`);

  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`Fichier manquant : ${FILE_PATH}`);
  }

  const buffer = fs.readFileSync(FILE_PATH);
  const form = new FormData();
  form.append("action", "analyze");
  form.append(
    "file",
    new File([buffer], "emploi_du_temps_rentree.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );

  console.log(`\nPOST /api/emploi-du-temps/import analyze (sans cookie)…`);
  const analyze = await fetchJson(`${BASE_URL}/api/emploi-du-temps/import`, { method: "POST", body: form });
  console.log(`  HTTP ${analyze.response.status} (${analyze.ms}ms)`);
  console.log(`  importStatus : ${analyze.data.importStatus ?? "—"}`);
  console.log(`  profileId : ${analyze.data.profileId ?? "—"}`);
  console.log(`  userId : ${analyze.data.userId ?? "null"}`);
  console.log(`  slotCount : ${analyze.data.slotCount ?? "—"}`);
  if (analyze.data.error) console.log(`  error : ${analyze.data.error}`);

  const parsed = analyze.data.parsed as { sessions?: Array<{ isEmpty?: boolean }> } | undefined;
  const sessions = (parsed?.sessions ?? []).filter((session) => !session.isEmpty);
  if (!analyze.response.ok || sessions.length === 0) {
    console.log("\nNON RÉSOLU — analyse bloquée ou vide.");
    process.exit(1);
  }

  const save = await fetchJson(`${BASE_URL}/api/emploi-du-temps/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save",
      scheduleName: "Diagnostic mono-utilisateur",
      isPrimary: true,
      sessions,
      sourceFileName: "emploi_du_temps_rentree.xlsx",
    }),
  });
  console.log(`\nPOST save → HTTP ${save.response.status} (${save.ms}ms)`);
  const savedSlots = (save.data.slots as unknown[] | undefined)?.length ?? 0;
  const savedSchedule = save.data.schedule as { id?: string; teacherProfileId?: string | null } | undefined;
  console.log(`  schedule_id : ${savedSchedule?.id ?? "—"}`);
  console.log(`  teacher_profile_id : ${savedSchedule?.teacherProfileId ?? "null"}`);
  console.log(`  créneaux enregistrés : ${savedSlots}`);

  const profilAfter = await fetchJson(`${BASE_URL}/api/profil`);
  const completionAfter = profilAfter.data.completion as { complete?: boolean; missing?: string[] } | undefined;
  const edtMissing = completionAfter?.missing?.includes("Emploi du temps actif (module Emploi du temps)") ?? true;

  console.log(`\nGET /api/profil après import (${profilAfter.ms}ms)`);
  console.log(`  Profil complet : ${completionAfter?.complete ? "oui" : "non"}`);
  console.log(`  EDT manquant : ${edtMissing ? "OUI" : "NON"}`);

  if (savedSlots === 56 && !edtMissing) {
    console.log("\nImport mono-utilisateur : OK (56 créneaux, profil reconnaît l'EDT)");
    return;
  }

  console.log("\nNON RÉSOLU — profil ne reconnaît pas l'EDT ou créneaux incorrects.");
  process.exit(1);
}

main().catch((error) => {
  console.error("Diagnostic ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
