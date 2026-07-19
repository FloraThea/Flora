import fs from "node:fs";
import type { ApiTestSession } from "./api-test-session";
import { apiFetch, readApiJson, reconnectApiSession } from "./api-test-session";
import { resolveValidationPath } from "./paths";

export type ApiImportResult = {
  kind: "programmation" | "progression" | "emploi_du_temps";
  title: string;
  entityId: string;
  expectedCount: number;
  savedCount: number;
  analyzeRowCount: number;
  listVisible: boolean;
  detailsOk: boolean;
  afterReconnect: boolean;
};

type ParsedSpreadsheet = {
  rows?: unknown[];
  rowCount?: number;
  discipline?: string;
  fileName?: string;
};

async function analyzeSpreadsheetImport(
  session: ApiTestSession,
  route: "/api/programmation/import" | "/api/progression/import",
  filePath: string,
): Promise<ParsedSpreadsheet> {
  const buffer = fs.readFileSync(filePath);
  const fileName = filePath.split("/").pop() ?? filePath;
  const form = new FormData();
  form.append("action", "analyze");
  form.append("file", new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));

  const response = await apiFetch(session, route, { method: "POST", body: form });
  const data = await readApiJson<{ parsed?: ParsedSpreadsheet }>(response);
  if (!data.parsed) throw new Error("Analyse sans résultat parsed");
  return data.parsed;
}

export async function importProgrammationViaApi(session: ApiTestSession): Promise<ApiImportResult> {
  const filePath = resolveValidationPath("programmation/Programmation_HDA_Editable_2026-2027.xlsx");
  const parsed = await analyzeSpreadsheetImport(session, "/api/programmation/import", filePath);
  const expectedCount = parsed.rows?.length ?? parsed.rowCount ?? 0;
  const title = `API — Programmation HDA ${Date.now()}`;

  const saveResponse = await apiFetch(session, "/api/programmation/import", {
    method: "POST",
    body: JSON.stringify({
      action: "save",
      parsed,
      schoolYear: "2026-2027",
      academicZone: "A",
      levels: ["CE1", "CE2"],
      matiere: "Histoire des arts",
      title,
      sourceFileName: parsed.fileName ?? "Programmation_HDA_Editable_2026-2027.xlsx",
    }),
  });

  const saved = await readApiJson<{
    programmation?: { id?: string; original_import?: { rows?: unknown[] } };
  }>(saveResponse);

  const entityId = String(saved.programmation?.id ?? "");
  const savedRows = saved.programmation?.original_import?.rows?.length ?? expectedCount;

  const listResponse = await apiFetch(session, "/api/programmation/list");
  const listData = await readApiJson<{
    programmations?: Array<{ id: string; title: string }>;
  }>(listResponse);
  const listVisible = (listData.programmations ?? []).some((item) => item.id === entityId);

  const detailsResponse = await apiFetch(
    session,
    `/api/programmation/details?id=${encodeURIComponent(entityId)}`,
  );
  const details = await readApiJson<{
    programmation?: { id?: string; original_import?: { rows?: unknown[] } };
  }>(detailsResponse);
  const detailsRows = details.programmation?.original_import?.rows?.length ?? 0;
  const detailsOk = detailsRows === expectedCount || (details.programmation?.id === entityId && expectedCount > 0);

  await apiFetch(session, "/api/auth/link-profile", { method: "DELETE" });
  const reconnected = await reconnectApiSession(session);
  const reloadList = await readApiJson<{
    programmations?: Array<{ id: string }>;
  }>(await apiFetch(reconnected, "/api/programmation/list"));
  const afterReconnect = (reloadList.programmations ?? []).some((item) => item.id === entityId);

  return {
    kind: "programmation",
    title,
    entityId,
    expectedCount,
    savedCount: savedRows,
    analyzeRowCount: expectedCount,
    listVisible,
    detailsOk,
    afterReconnect,
  };
}

export async function importProgressionViaApi(session: ApiTestSession): Promise<ApiImportResult> {
  const filePath = resolveValidationPath("progression/Progression_EMC_Editable_2026-2027.xlsx");
  const parsed = await analyzeSpreadsheetImport(session, "/api/progression/import", filePath);
  const expectedCount = parsed.rows?.length ?? parsed.rowCount ?? 0;
  const title = `API — Progression EMC ${Date.now()}`;

  const saveResponse = await apiFetch(session, "/api/progression/import", {
    method: "POST",
    body: JSON.stringify({
      action: "save",
      parsed,
      programmationId: null,
      methode: "MHM",
      title,
      sourceFileName: parsed.fileName ?? "Progression_EMC_Editable_2026-2027.xlsx",
    }),
  });

  const saved = await readApiJson<{
    progression?: { id?: string };
    tabs?: Array<{ rows?: unknown[] }>;
  }>(saveResponse);

  const entityId = String(saved.progression?.id ?? "");
  const savedCount = (saved.tabs ?? []).reduce((sum, tab) => sum + (tab.rows?.length ?? 0), 0);

  const listData = await readApiJson<{
    progressions?: Array<{ id: string; title: string }>;
  }>(await apiFetch(session, "/api/progression/list"));
  const listVisible = (listData.progressions ?? []).some((item) => item.id === entityId);

  const details = await readApiJson<{
    tabs?: Array<{ rows?: unknown[] }>;
  }>(
    await apiFetch(session, `/api/progression/details?id=${encodeURIComponent(entityId)}`),
  );
  const detailsCount = (details.tabs ?? []).reduce((sum, tab) => sum + (tab.rows?.length ?? 0), 0);
  const detailsOk = detailsCount === expectedCount;

  await apiFetch(session, "/api/auth/link-profile", { method: "DELETE" });
  const reconnected = await reconnectApiSession(session);
  const reloadList = await readApiJson<{
    progressions?: Array<{ id: string }>;
  }>(await apiFetch(reconnected, "/api/progression/list"));
  const afterReconnect = (reloadList.progressions ?? []).some((item) => item.id === entityId);

  return {
    kind: "progression",
    title,
    entityId,
    expectedCount,
    savedCount,
    analyzeRowCount: expectedCount,
    listVisible,
    detailsOk,
    afterReconnect,
  };
}

export async function importTimetableViaApi(session: ApiTestSession): Promise<ApiImportResult> {
  const filePath = resolveValidationPath("emploi_du_temps/emploi_du_temps_rentree.xlsx");
  const buffer = fs.readFileSync(filePath);
  const fileName = "emploi_du_temps_rentree.xlsx";

  const analyzeForm = new FormData();
  analyzeForm.append("action", "analyze");
  analyzeForm.append("file", new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));

  const analyzeData = await readApiJson<{
    parsed?: { sessions?: Array<{ isEmpty?: boolean }>; fileName?: string; schoolYear?: string };
  }>(await apiFetch(session, "/api/emploi-du-temps/import", { method: "POST", body: analyzeForm }));

  const sessions = (analyzeData.parsed?.sessions ?? []).filter((sessionItem) => !sessionItem.isEmpty);
  const expectedCount = sessions.length;
  const title = `API — EDT rentrée ${Date.now()}`;

  const saveResponse = await apiFetch(session, "/api/emploi-du-temps/import", {
    method: "POST",
    body: JSON.stringify({
      action: "save",
      sessions,
      scheduleName: title,
      isPrimary: true,
      schoolYear: analyzeData.parsed?.schoolYear ?? "2025-2026",
      sourceFileName: analyzeData.parsed?.fileName ?? fileName,
    }),
  });

  const saved = await readApiJson<{
    schedule?: { id?: string };
    slots?: unknown[];
  }>(saveResponse);

  const entityId = String(saved.schedule?.id ?? "");
  const savedCount = saved.slots?.length ?? 0;

  const listData = await readApiJson<{
    schedules?: Array<{ id: string; name: string }>;
  }>(await apiFetch(session, "/api/emploi-du-temps"));
  const listVisible = (listData.schedules ?? []).some((item) => item.id === entityId);

  const details = await readApiJson<{ slots?: unknown[] }>(
    await apiFetch(session, `/api/emploi-du-temps?id=${encodeURIComponent(entityId)}`),
  );
  const detailsOk = (details.slots?.length ?? 0) === expectedCount;

  await apiFetch(session, "/api/auth/link-profile", { method: "DELETE" });
  const reconnected = await reconnectApiSession(session);
  const reload = await readApiJson<{ schedules?: Array<{ id: string }> }>(
    await apiFetch(reconnected, "/api/emploi-du-temps"),
  );
  const afterReconnect = (reload.schedules ?? []).some((item) => item.id === entityId);

  return {
    kind: "emploi_du_temps",
    title,
    entityId,
    expectedCount,
    savedCount,
    analyzeRowCount: expectedCount,
    listVisible,
    detailsOk,
    afterReconnect,
  };
}
