import assert from "node:assert/strict";
import {
  countFilledCells,
  userMessageForGenerationError,
} from "./generation-diagnostics";
import type { ProgrammingTable } from "./types";

const results: Array<{ name: string; ok: boolean; error?: string }> = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, error: message });
    console.error(`✗ ${name}: ${message}`);
  }
}

test("countFilledCells ignores empty skeleton cells", () => {
  const tables: ProgrammingTable[] = [
    {
      subjectKey: "fr",
      subjectLabel: "Français",
      subSubjectLabel: "",
      accent: "rose",
      sortOrder: 0,
      periods: [
        {
          periodNumber: 1,
          weekCount: 7,
          startDate: "",
          endDate: "",
          label: "P1",
          cell: { id: "c1", content: "", competences: [], notions: [], resources: [], guides: [], modules: [] },
        },
        {
          periodNumber: 2,
          weekCount: 7,
          startDate: "",
          endDate: "",
          label: "P2",
          cell: {
            id: "c2",
            content: "Poésie",
            competences: [],
            notions: [],
            resources: [],
            guides: [],
            modules: [],
          },
        },
      ],
    },
  ];
  assert.equal(countFilledCells(tables), 1);
});

test("userMessageForGenerationError maps profile errors", () => {
  const msg = userMessageForGenerationError(new Error("Configurez votre profil pédagogique"));
  assert.match(msg, /profil/i);
});

test("userMessageForGenerationError maps empty content", () => {
  const msg = userMessageForGenerationError(new Error("Le contenu généré est vide"));
  assert.match(msg, /échoué/i);
});

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`);
  process.exit(1);
}
console.log(`\n${results.length} programming tests passed`);
