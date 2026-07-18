/**
 * Captures d'écran de validation — nécessite Playwright et un serveur Flora actif.
 *
 * Usage :
 *   npm run dev
 *   npm run test:validation:screenshots
 *
 * Les captures de référence sont dans tests/validation/captures/reference/
 * Les captures courantes sont dans tests/validation/captures/current/
 */
import fs from "node:fs";
import path from "node:path";
import { resolveValidationPath } from "./lib/paths";

const BASE_URL = process.env.FLORA_VALIDATION_BASE_URL ?? "http://localhost:3000";
const PAGES = [
  { id: "programmation", route: "/programmation", file: "programmation.png" },
  { id: "progression", route: "/progression", file: "progression.png" },
  { id: "emploi_du_temps", route: "/emploi-du-temps", file: "emploi-du-temps.png" },
  { id: "cahier_journal", route: "/cahier-journal", file: "cahier-journal.png" },
] as const;

async function main() {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    console.error(
      "Playwright non installé. Exécutez : npm install -D playwright && npx playwright install chromium",
    );
    process.exit(1);
  }

  const referenceDir = resolveValidationPath("captures/reference");
  const currentDir = resolveValidationPath("captures/current");
  fs.mkdirSync(referenceDir, { recursive: true });
  fs.mkdirSync(currentDir, { recursive: true });

  const baseline = process.argv.includes("--baseline");
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const diffs: string[] = [];

  for (const item of PAGES) {
    const currentPath = path.join(currentDir, item.file);
    const referencePath = path.join(referenceDir, item.file);

    await page.goto(`${BASE_URL}${item.route}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: currentPath, fullPage: true });

    if (baseline || !fs.existsSync(referencePath)) {
      fs.copyFileSync(currentPath, referencePath);
      console.log(`✓ baseline capture ${item.id}`);
      continue;
    }

    const current = fs.readFileSync(currentPath);
    const reference = fs.readFileSync(referencePath);
    if (!current.equals(reference)) {
      diffs.push(item.id);
      console.log(`✗ différence capture ${item.id}`);
    } else {
      console.log(`✓ capture ${item.id}`);
    }
  }

  await browser.close();

  if (diffs.length > 0 && !baseline) {
    console.error(`Captures différentes : ${diffs.join(", ")}`);
    process.exit(1);
  }

  console.log("\nCaptures de validation terminées.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
