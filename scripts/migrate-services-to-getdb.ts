/**
 * Propage floraDb() sur tous les fichiers serveur utilisant le client anon.
 * Usage: node --import tsx scripts/migrate-services-to-getdb.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const EXCLUDE = new Set([
  "scripts/migrate-services-to-getdb.ts",
  "lib/supabase.ts",
  "lib/supabase/get-db.ts",
  "lib/supabase/server-client.ts",
  "lib/supabase/auth-server.ts",
  "app/connexion/page.tsx",
  "lib/documents/import/import-error-diagnostics.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "scripts") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function relative(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function migrateFile(filePath: string): boolean {
  const rel = relative(filePath);
  if (EXCLUDE.has(rel)) return false;

  let src = fs.readFileSync(filePath, "utf8");
  let changed = false;

  if (src.includes('import { supabase } from "@/lib/supabase"')) {
    src = src.replace(
      /import \{ supabase \} from "@\/lib\/supabase";/g,
      'import { floraDb } from "@/lib/supabase/get-db";',
    );
    src = src.replace(/(?<![\w/"'])supabase(?![\w-])/g, (match, offset, full) => {
      const lineStart = full.lastIndexOf("\n", offset) + 1;
      const lineEnd = full.indexOf("\n", offset);
      const line = full.slice(lineStart, lineEnd === -1 ? full.length : lineEnd);
      if (line.includes("import ") || line.includes("from \"@/lib/supabase")) return match;
      return "(await floraDb())";
    });
    changed = true;
  }

  if (src.includes("async function floraDb()")) {
    src = src.replace(/\nasync function floraDb\(\) \{\n  return getDb\(\);\n\}\n/g, "\n");
    src = src.replace(
      /import \{ getDb \} from "@\/lib\/supabase\/get-db";/g,
      'import { floraDb } from "@/lib/supabase/get-db";',
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, src);
  }
  return changed;
}

const files = walk(ROOT);
let count = 0;
for (const file of files) {
  if (migrateFile(file)) {
    console.log("Updated", relative(file));
    count += 1;
  }
}
console.log(`Done — ${count} file(s) migrated.`);
