import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  apiFetch,
  createApiTestSession,
  readApiJson,
  reconnectApiSession,
  type ApiTestSession,
} from "./lib/api-test-session";

const EDT_MISSING = "Emploi du temps actif (module Emploi du temps)";
const FILE_PATH = path.resolve(
  process.cwd(),
  "tests/validation/emploi_du_temps/emploi_du_temps_rentree.xlsx",
);

type ProfilApiResponse = {
  values: Record<string, unknown>;
  status: string;
  completion: { complete: boolean; missing: string[] };
  error?: string;
};

async function importRealTimetable(session: ApiTestSession) {
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(`Fichier manquant: ${FILE_PATH}`);
  }

  const buffer = fs.readFileSync(FILE_PATH);
  const fileName = "emploi_du_temps_rentree.xlsx";

  const analyzeForm = new FormData();
  analyzeForm.append("action", "analyze");
  analyzeForm.append("file", new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));

  const analyzeResponse = await apiFetch(session, "/api/emploi-du-temps/import", {
    method: "POST",
    body: analyzeForm,
  });
  const analyzeData = await readApiJson<{
    importStatus?: string;
    parsed?: { sessions?: Array<{ isEmpty?: boolean }>; schoolYear?: string };
    error?: string;
  }>(analyzeResponse);

  assert.equal(analyzeData.importStatus, "completed");
  const sessions = (analyzeData.parsed?.sessions ?? []).filter((item) => !item.isEmpty);
  assert.equal(sessions.length, 56, "Analyse multipart doit produire 56 créneaux");

  const saveResponse = await apiFetch(session, "/api/emploi-du-temps/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save",
      scheduleName: "EDT profil — test réel",
      isPrimary: true,
      schoolYear: analyzeData.parsed?.schoolYear ?? "2026-2027",
      sessions,
      sourceFileName: fileName,
    }),
  });

  const saveData = await readApiJson<{ slots?: unknown[]; error?: string }>(saveResponse);
  assert.ok(Array.isArray(saveData.slots));
  assert.equal(saveData.slots?.length, 56);
}

async function readProfile(session: ApiTestSession) {
  const response = await apiFetch(session, "/api/profil");
  return readApiJson<ProfilApiResponse>(response);
}

async function main() {
  const baseUrl = process.env.FLORA_VALIDATION_BASE_URL?.trim() || "http://localhost:3000";
  const session = await createApiTestSession(baseUrl);

  await importRealTimetable(session);

  const profileAfterImport = await readProfile(session);
  assert.equal(
    profileAfterImport.completion.missing.includes(EDT_MISSING),
    false,
    `EDT manquant à tort: ${profileAfterImport.completion.missing.join(", ")}`,
  );

  const saveResponse = await apiFetch(session, "/api/profil", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileAfterImport.values),
  });
  const saved = await readApiJson<ProfilApiResponse>(saveResponse);
  assert.equal(saved.completion.missing.includes(EDT_MISSING), false);

  const reloaded = await readProfile(session);
  assert.equal(reloaded.completion.missing.includes(EDT_MISSING), false);

  const reconnected = await reconnectApiSession(session);
  const afterReconnect = await readProfile(reconnected);
  assert.equal(afterReconnect.completion.missing.includes(EDT_MISSING), false);

  console.log("✓ Profil détecte l'EDT réel (56 créneaux) après import, save, reload et reconnexion");
  console.log(`  Champs manquants restants: ${afterReconnect.completion.missing.join(", ") || "aucun"}`);
}

main().catch((error) => {
  console.error("Test profil/EDT ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
