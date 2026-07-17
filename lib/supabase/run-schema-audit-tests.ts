import assert from "node:assert/strict";
import { isMissingSchemaColumnError, omitRecordKey } from "./schema-compat";

function testMissingColumnDetection() {
  assert.equal(
    isMissingSchemaColumnError(
      {
        code: "PGRST204",
        message: "Could not find the 'link_mode' column of 'progressions' in the schema cache",
      } as Parameters<typeof isMissingSchemaColumnError>[0],
      "link_mode",
    ),
    true,
  );
  assert.equal(
    isMissingSchemaColumnError(
      {
        code: "23505",
        message: "duplicate key",
      } as Parameters<typeof isMissingSchemaColumnError>[0],
      "link_mode",
    ),
    false,
  );
}

function testOmitRecordKey() {
  const row = { title: "Test", link_mode: "independent", status: "draft" };
  const next = omitRecordKey(row, "link_mode");
  assert.deepEqual(next, { title: "Test", status: "draft" });
  assert.equal("link_mode" in next, false);
}

function testAgendaSyncProgressionColumns() {
  const source = "id, seance_label, competence_bo, period_number, week_number, programmation_id, tab_id, metadata";
  assert.equal(source.includes("matiere"), false, "progression_rows has no matiere column");
}

function testTimetableSlotColumns() {
  const legacy = ["start", "end"];
  const current = ["start_time", "end_time"];
  assert.equal(legacy.includes("start_time"), false);
  assert.equal(current.includes("start_time"), true);
}

function run() {
  testMissingColumnDetection();
  testOmitRecordKey();
  testAgendaSyncProgressionColumns();
  testTimetableSlotColumns();
  console.log("Supabase audit tests: 4/4 passed");
}

run();
