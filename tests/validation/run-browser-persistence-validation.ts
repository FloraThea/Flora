/**
 * Persistance visuelle navigateur — changement d'onglet, refresh, reconnexion
 *
 * Usage :
 *   npm run dev
 *   npm run test:validation:browser
 *
 * Nécessite Playwright : npm install -D playwright && npx playwright install chromium
 */
import fs from "node:fs";
import path from "node:path";
import {
  cleanupApiTestSession,
  createApiTestSession,
  logoutApiSession,
  reconnectApiSession,
} from "./lib/api-test-session";
import {
  importProgrammationViaApi,
  importProgressionViaApi,
  importTimetableViaApi,
} from "./lib/api-import-flows";

const BASE_URL = process.env.FLORA_VALIDATION_BASE_URL ?? "http://localhost:3000";
const REPORT_OUT = path.resolve(process.cwd(), "docs/validation-reelle-browser-persistence.md");

const PROGRAMMATION_DISPLAY_HINTS = [
  "Programmation_HDA_Editable_2026-2027",
  "Programmation HDA",
];
const PROGRESSION_DISPLAY_HINTS = [
  "Progression_EMC_Editable_2026-2027",
  "Progression EMC",
];

async function waitForDocumentCard(page: import("playwright").Page, labels: string[]) {
  for (const label of labels) {
    const locator = page.getByRole("article").filter({ hasText: label });
    if ((await locator.count()) > 0) return label;
  }

  for (const label of labels) {
    const locator = page.getByText(label, { exact: false });
    if ((await locator.count()) > 0) return label;
  }

  return null;
}

type BrowserStep = {
  name: string;
  ok: boolean;
  detail: string;
};

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Playwright non installé. Exécutez : npm install -D playwright && npx playwright install chromium",
    );
  }
}

function writeReport(steps: BrowserStep[], titles: { programmation: string; progression: string }) {
  const lines = [
    "# Validation réelle — persistance navigateur",
    "",
    `- Base URL : \`${BASE_URL}\``,
    `- Date : ${new Date().toISOString()}`,
    "",
    "## Étapes",
    "",
    ...steps.map((step) => `- ${step.ok ? "✓" : "✗"} **${step.name}** — ${step.detail}`),
    "",
    "## Données de référence importées via API avant le test navigateur",
    "",
    `- Programmation : ${titles.programmation}`,
    `- Progression : ${titles.progression}`,
    `- Emploi du temps : créneaux « Rituels : Copie des devoirs » visibles dans la grille`,
    "",
  ];

  fs.mkdirSync(path.dirname(REPORT_OUT), { recursive: true });
  fs.writeFileSync(REPORT_OUT, `${lines.join("\n")}\n`);
}

async function main() {
  const steps: BrowserStep[] = [];
  const session = await createApiTestSession(BASE_URL);

  const hda = await importProgrammationViaApi(session);
  const emc = await importProgressionViaApi(session);
  await importTimetableViaApi(session);

  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: "flora-auth-token",
      value: session.accessToken,
      domain: new URL(BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/programmation`, { waitUntil: "networkidle" });
    await page.getByText(/Programmations enregistr/i).waitFor({ timeout: 15000 }).catch(() => undefined);
    const progLabel = await waitForDocumentCard(page, [hda.title, ...PROGRAMMATION_DISPLAY_HINTS]);
    const progVisible = progLabel !== null;
    steps.push({
      name: "Programmation visible après import API",
      ok: progVisible,
      detail: progVisible ? progLabel : "Titre absent de la liste documentaire",
    });
    if (!progVisible) throw new Error("Programmation absente de l'UI");

    await page.goto(`${BASE_URL}/progression`, { waitUntil: "networkidle" });
    await page.getByText(/Progressions enregistr/i).waitFor({ timeout: 15000 }).catch(() => undefined);
    steps.push({
      name: "Changement d'onglet → Progression",
      ok: true,
      detail: "Navigation OK",
    });

    const emcLabel = await waitForDocumentCard(page, [emc.title, ...PROGRESSION_DISPLAY_HINTS]);
    const emcVisible = emcLabel !== null;
    steps.push({
      name: "Progression visible",
      ok: emcVisible,
      detail: emcVisible ? emcLabel : "Titre absent de la liste documentaire",
    });
    if (!emcVisible) throw new Error("Progression absente de l'UI");

    await page.goto(`${BASE_URL}/emploi-du-temps`, { waitUntil: "networkidle" });
    steps.push({
      name: "Changement d'onglet → Emploi du temps",
      ok: true,
      detail: "Navigation OK",
    });

    const edtText = page.getByText(/Rituels|Copie des devoirs/i);
    const edtVisible = (await edtText.count()) > 0;
    steps.push({
      name: "EDT — contenu importé visible",
      ok: edtVisible,
      detail: edtVisible ? "Créneau repéré dans la grille" : "Texte source absent",
    });
    if (!edtVisible) throw new Error("Contenu EDT absent de l'UI");

    await page.goto(`${BASE_URL}/programmation`, { waitUntil: "networkidle" });
    steps.push({
      name: "Retour onglet Programmation",
      ok: (await waitForDocumentCard(page, [hda.title, ...PROGRAMMATION_DISPLAY_HINTS])) !== null,
      detail: hda.title,
    });

    await page.reload({ waitUntil: "networkidle" });
    const afterRefresh =
      (await waitForDocumentCard(page, [hda.title, ...PROGRAMMATION_DISPLAY_HINTS])) !== null;
    steps.push({
      name: "Actualisation navigateur",
      ok: afterRefresh,
      detail: afterRefresh ? "Programmation toujours listée" : "Données perdues après refresh",
    });
    if (!afterRefresh) throw new Error("Persistance perdue après refresh");

    await logoutApiSession(session);
    await context.clearCookies();

    await page.goto(`${BASE_URL}/connexion`, { waitUntil: "networkidle" });
    await page.fill("#email", session.email);
    await page.fill("#password", session.password);
    await page.getByRole("button", { name: /Se connecter|Créer mon compte/i }).click();
    await page.waitForURL(/\/profil/, { timeout: 15000 });

    steps.push({
      name: "Déconnexion + reconnexion UI",
      ok: true,
      detail: "Redirection profil après connexion",
    });

    const reconnected = await reconnectApiSession(session);
    await context.addCookies([
      {
        name: "flora-auth-token",
        value: reconnected.accessToken,
        domain: new URL(BASE_URL).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto(`${BASE_URL}/programmation`, { waitUntil: "networkidle" });
    const progAfterLogin =
      (await waitForDocumentCard(page, [hda.title, ...PROGRAMMATION_DISPLAY_HINTS])) !== null;

    await page.goto(`${BASE_URL}/progression`, { waitUntil: "networkidle" });
    const emcAfterLogin =
      (await waitForDocumentCard(page, [emc.title, ...PROGRESSION_DISPLAY_HINTS])) !== null;

    const afterLogin = progAfterLogin && emcAfterLogin;

    steps.push({
      name: "Données complètes après reconnexion",
      ok: afterLogin,
      detail: afterLogin
        ? "Programmation + progression toujours présentes"
        : "Données manquantes après reconnexion",
    });
    if (!afterLogin) throw new Error("Données incomplètes après reconnexion");

    writeReport(steps, { programmation: hda.title, progression: emc.title });
    console.log(`Rapport : ${REPORT_OUT}`);
    console.log("\nTest navigateur : SUCCÈS");
  } finally {
    await browser.close();
    await cleanupApiTestSession(session);
  }
}

main().catch((error) => {
  console.error("\nTest navigateur ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
