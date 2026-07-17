/**
 * Remplace `supabase` par `(await floraDb())` dans les services serveur.
 * Usage: node --import tsx scripts/migrate-services-to-getdb.ts
 */
import fs from "node:fs";

const files = [
  "lib/programming/programmation-service.ts",
  "lib/progression/progression-service.ts",
  "lib/seances/seance-service.ts",
  "lib/sequences/sequence-service.ts",
  "lib/documents/document-service.ts",
  "lib/journal/journal-service.ts",
  "lib/timetable/timetable-service.ts",
  "lib/agenda/agenda-service.ts",
  "lib/journal/journal-entry-service.ts",
  "lib/annual-planner/planner-service.ts",
  "app/api/dashboard/summary/route.ts",
];

const helper = `
async function floraDb() {
  return getDb();
}
`;

for (const file of files) {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("async function floraDb()")) continue;

  if (!src.includes('from "@/lib/supabase/get-db"')) {
    src = src.replace(
      /import \{ supabase \} from "@\/lib\/supabase";/,
      'import { getDb } from "@/lib/supabase/get-db";',
    );
  }

  const importEnd = src.lastIndexOf("\nimport ");
  const nextLineAfterImports = src.indexOf("\n", src.indexOf("from ", importEnd));
  const insertAt = nextLineAfterImports === -1 ? src.length : nextLineAfterImports + 1;
  src = src.slice(0, insertAt) + helper + src.slice(insertAt);

  // Avoid import paths, error helpers, and already migrated calls
  src = src.replace(/(?<![\w/"'])supabase(?![\w-])/g, (match, offset, full) => {
    const lineStart = full.lastIndexOf("\n", offset) + 1;
    const line = full.slice(lineStart, full.indexOf("\n", offset));
    if (line.includes("import ") || line.includes("from \"@/lib/supabase")) return match;
    return "(await floraDb())";
  });

  fs.writeFileSync(file, src);
  console.log("Updated", file);
}
