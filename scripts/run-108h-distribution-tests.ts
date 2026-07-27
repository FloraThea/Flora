/**
 * Tests — répartition réglementaire des 108 h.
 * Usage : node node_modules/tsx/dist/cli.mjs scripts/run-108h-distribution-tests.ts
 */
import assert from "node:assert/strict";
import {
  HOURS_108_CATEGORIES,
  HOURS_108_QUOTA_PRESETS,
  TOTAL_108H_AT_100,
  computePlannedMinutesForCategory,
  computeTotalHoursForQuota,
  computeTotalPlannedMinutes,
  normalizeLegacyCategoryCode,
} from "@/lib/agenda/hours-108";

function testFullTimeTotal(): void {
  assert.equal(TOTAL_108H_AT_100, 108, "Total temps plein = 108 h");

  const sum = HOURS_108_CATEGORIES.reduce((acc, cat) => acc + cat.baseHoursAt100, 0);
  assert.equal(sum, 108);

  assert.equal(HOURS_108_CATEGORIES.find((c) => c.code === "108_apc")?.baseHoursAt100, 36);
  assert.equal(HOURS_108_CATEGORIES.find((c) => c.code === "108_prep_apc")?.baseHoursAt100, 24);
  assert.equal(HOURS_108_CATEGORIES.find((c) => c.code === "108_conseils_maitres")?.baseHoursAt100, 24);
  assert.equal(HOURS_108_CATEGORIES.find((c) => c.code === "108_animations")?.baseHoursAt100, 18);
  assert.equal(HOURS_108_CATEGORIES.find((c) => c.code === "108_conseils")?.baseHoursAt100, 6);

  console.log("✓ Répartition temps plein (108 h)");
}

function testQuotaPresets(): void {
  for (const preset of HOURS_108_QUOTA_PRESETS) {
    const categorySum = Object.values(preset.categories).reduce((a, b) => a + b, 0);
    assert.equal(
      Math.round(categorySum * 100) / 100,
      preset.totalHours,
      `Quotité ${preset.label}: somme catégories ≠ total`,
    );

    const plannedMinutes = computeTotalPlannedMinutes(preset.percentage);
    assert.equal(
      plannedMinutes,
      Math.round(preset.totalHours * 60),
      `Quotité ${preset.label}: minutes planifiées incorrectes`,
    );
  }

  assert.equal(computeTotalHoursForQuota(100), 108);
  assert.equal(computeTotalHoursForQuota(80), 87);
  assert.equal(computeTotalHoursForQuota(75), 81);
  assert.equal(computeTotalHoursForQuota(50), 54);
  assert.equal(computeTotalHoursForQuota(33), 36);

  console.log("✓ Quotités partielles (100 %, 80 %, 75 %, 50 %, M2)");
}

function testPartTimeCategoryHours(): void {
  assert.equal(computePlannedMinutesForCategory("108_apc", 50), 18 * 60);
  assert.equal(computePlannedMinutesForCategory("108_prep_apc", 50), 12 * 60);
  assert.equal(computePlannedMinutesForCategory("108_conseils_maitres", 50), 12 * 60);
  assert.equal(computePlannedMinutesForCategory("108_animations", 50), 9 * 60);
  assert.equal(computePlannedMinutesForCategory("108_conseils", 50), 3 * 60);

  assert.equal(computePlannedMinutesForCategory("108_apc", 75), 27 * 60);
  assert.equal(computePlannedMinutesForCategory("108_animations", 75), 13.5 * 60);
  assert.equal(computePlannedMinutesForCategory("108_conseils", 75), 4.5 * 60);

  assert.equal(computePlannedMinutesForCategory("108_conseils_maitres", 80), 19.25 * 60);
  assert.equal(computePlannedMinutesForCategory("108_animations", 80), 14.5 * 60);

  console.log("✓ Heures par catégorie et quotité");
}

function testLegacyMapping(): void {
  assert.equal(normalizeLegacyCategoryCode("108_equipe_familles"), "108_conseils_maitres");
  assert.equal(normalizeLegacyCategoryCode("108_apc"), "108_apc");
  console.log("✓ Remapping anciennes catégories");
}

function testNoOldDistribution(): void {
  const oldCodes = [
    "108_equipe_familles",
    "108_pre_rentree",
    "108_journee_academique",
    "108_journee_solidarite",
  ];
  for (const code of oldCodes) {
    assert.equal(
      HOURS_108_CATEGORIES.some((item) => item.code === code),
      false,
      `Ancienne catégorie encore active : ${code}`,
    );
  }

  const oldTotals = { apc: 36, animations: 36, conseils: 18, equipe: 18, pre: 6, acad: 6, solid: 6 };
  assert.notEqual(
    oldTotals.apc + oldTotals.animations + oldTotals.conseils + oldTotals.equipe + oldTotals.pre + oldTotals.acad + oldTotals.solid,
    108,
    "L'ancienne répartition ne doit plus totaliser 108 h",
  );

  console.log("✓ Ancienne répartition (126 h) retirée");
}

function main() {
  testFullTimeTotal();
  testQuotaPresets();
  testPartTimeCategoryHours();
  testLegacyMapping();
  testNoOldDistribution();
  console.log("\nTous les tests 108 h ont réussi.");
}

main();
