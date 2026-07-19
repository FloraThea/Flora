import assert from "node:assert/strict";
import { listProfileMissingFields } from "./profile-context";

const EDT_MISSING = "Emploi du temps actif (module Emploi du temps)";

function buildBundle(profileId: string) {
  return {
    profile: {
      id: profileId,
      nom: "Dupont",
      prenom: "Camille",
      ecoleNom: "",
      commune: "",
      academie: "",
      zoneScolaire: "A" as const,
      pays: "France",
      schoolYear: "2026-2027",
      levels: ["CE1" as const],
      studentCount: 24,
      classType: "simple" as const,
      ulis: false,
      segpa: false,
      rep: false,
      repPlus: false,
      workQuotaPercentage: 100,
      workQuotaLabel: "100 %",
      workingDays: ["Lundi", "Mardi"],
      timetables: [],
      defaultTimetableId: "",
      personalization: {
        accentColor: "rose",
        fontStyle: "mix",
        logoUrl: "",
        className: "",
        schoolName: "",
        signature: "",
        appTheme: "flora",
      },
      status: "draft",
      metadata: {},
      created_at: "",
      updated_at: "",
    },
    preferences: {
      id: "pref",
      profileId,
      pedagogyStyles: [],
      resourcePriorities: [],
      aiDetailLevel: "moyen" as const,
      aiTone: "simple" as const,
      aiGenerationType: "equilibree" as const,
      exportFormats: [],
      exportOrder: [],
    },
    methods: [{ id: "m1", methodName: "MHM", isPrimary: true, sortOrder: 0 }],
    projects: [],
  };
}

const tests = [
  {
    name: "listProfileMissingFields excludes EDT when timetable is active",
    fn: () => {
      const missing = listProfileMissingFields(buildBundle("profile-test"), true);
      assert.equal(missing.includes(EDT_MISSING), false);
    },
  },
  {
    name: "listProfileMissingFields includes EDT when timetable is absent",
    fn: () => {
      const missing = listProfileMissingFields(buildBundle("profile-test"), false);
      assert.equal(missing.includes(EDT_MISSING), true);
    },
  },
];

let failed = 0;
for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${test.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${tests.length - failed}/${tests.length} tests passed`);
process.exit(failed > 0 ? 1 : 0);
