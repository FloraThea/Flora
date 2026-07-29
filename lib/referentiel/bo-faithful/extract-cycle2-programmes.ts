import type { SchoolNiveau } from "../niveau-utils";
import { CYCLE_2_NIVEAUX, detectAllSchoolNiveauxFromLine, normalizeSchoolNiveau } from "../niveau-utils";
import type { BoFaithfulCompetence, BoFaithfulExtractionResult, BoFaithfulTableReport } from "./types";
import { normalizeBoKey, normalizeBoLine } from "./normalize";
import { finalizeCompetencesWithStrictNiveau } from "./niveau-separation";

const TITLE_PATTERN =
  /Programmes\s+scolaires\s+(\d{4})\s*[–\-]\s*(Cycle\s+[123])\s*[–\-]\s*([^\n]+)/i;

const PAGE_HEADER_PATTERN = /^Programmes\s+scolaires\s+\d{4}/i;
const MAIN_SECTION_PATTERN = /^(\d+)\s+(.+)$/;
const EMC_SECTION_PATTERN = /^(\d+)\s+(CP|CE1|CE2)\s*:\s*(.+)$/i;
const NIVEAU_PREFIX_PATTERN = /^(CP|CE1|CE2)\s*:\s*(.+)$/i;
const THEME_PATTERN = /^Th[eè]me\s+\d+\s*:/i;
const PERIOD_MARKER_PATTERN =
  /^(En fin de p[eé]riode|En milieu d'ann[eé]e|En fin d'ann[eé]e|Tout au long de l'ann[eé]e|Des les premi[eè]res semaines|Des la p[eé]riode|A la fin de l'ann[eé]e)/i;
const BULLET_PATTERN = /^[•·\u2022\-–—]\s*/;
const SUB_BULLET_PATTERN = /^o\s+/i;

const SKIP_LINE_PATTERNS = [
  /^page\s+\d+/i,
];

function assignNiveauxToBulletBatch(bullets: string[]): SchoolNiveau[] {
  if (bullets.length === 0) return [];
  if (bullets.length === 1) return ["CP"];
  if (bullets.length === 2) return ["CP", "CE1"];
  if (bullets.length === 3) return ["CP", "CE1", "CE2"];

  const inferred = bullets.map((bullet) => inferNiveauFromCompetenceContent(bullet));
  const firstCe1 = inferred.findIndex((niveau) => niveau === "CE1" || niveau === "CE2");
  const firstCe2 = inferred.findIndex((niveau) => niveau === "CE2");

  if (firstCe1 === -1 && firstCe2 === -1) {
    const third = Math.ceil(bullets.length / 3);
    return bullets.map((_, index) => {
      if (index < third) return "CP";
      if (index < third * 2) return "CE1";
      return "CE2";
    });
  }

  const splitCe1 = firstCe1 === -1 ? bullets.length : firstCe1;
  const splitCe2 = firstCe2 === -1 ? bullets.length : firstCe2;

  return bullets.map((_, index) => {
    if (index < splitCe1) return "CP";
    if (index < splitCe2) return "CE1";
    return "CE2";
  });
}

type PendingThreeColumnBullet = {
  competence: string;
  tableTitle: string;
  sourceExcerpt: string;
  sortKey: number;
};

type ParserState = {
  sousMatiere: string;
  sousSousMatiere: string;
  tableTitle: string;
  currentNiveau: SchoolNiveau | "";
  threeColumnMode: boolean;
  columnNiveau: SchoolNiveau;
  themeColumnIndex: number;
  themeNiveauActive: boolean;
  pendingBullet: string;
  periodContext: string;
  threeColumnBatch: PendingThreeColumnBullet[];
  sortKey: number;
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bDe\b/g, "de")
    .replace(/\bDu\b/g, "du")
    .replace(/\bDes\b/g, "des")
    .replace(/\bLa\b/g, "la")
    .replace(/\bLe\b/g, "le")
    .replace(/\bLes\b/g, "les")
    .replace(/\bEt\b/g, "et")
    .replace(/\bOu\b/g, "ou")
    .replace(/^La /, "La ")
    .replace(/^Le /, "Le ")
    .replace(/^Les /, "Les ");
}

function normalizeMatiereLabel(raw: string): { matiere: string; domaine: string; programme: "francais" | "evar" | "emc_moral" } {
  const key = normalizeBoKey(raw);

  if (key.includes("mathematique")) {
    return { matiere: "Mathématiques", domaine: "Mathématiques", programme: "francais" };
  }
  if (key.includes("francais")) {
    return { matiere: "Français", domaine: "Français", programme: "francais" };
  }
  if (key === "emc" || key.includes("enseignement moral")) {
    return { matiere: "EMC", domaine: "Enseignement moral et civique", programme: "emc_moral" };
  }
  if (key.includes("evar") || key.includes("vie affective")) {
    return {
      matiere: "EMC",
      domaine: "Éducation à la vie affective et relationnelle",
      programme: "evar",
    };
  }
  if (key.includes("langues vivantes") || key.includes("langue vivante")) {
    return { matiere: "Langues vivantes", domaine: "Langues vivantes", programme: "francais" };
  }
  if (key.includes("histoire") && key.includes("geographie")) {
    return { matiere: "Histoire-Géographie", domaine: "Histoire-Géographie", programme: "francais" };
  }
  if (key.includes("sciences") && key.includes("technologie")) {
    return { matiere: "Sciences", domaine: "Sciences et technologie", programme: "francais" };
  }

  const cleaned = raw.replace(/\s+/g, " ").trim();
  return { matiere: cleaned, domaine: cleaned, programme: "francais" };
}

function inferMatiereFromFilename(filename: string): ReturnType<typeof normalizeMatiereLabel> | null {
  const key = normalizeBoKey(filename.replace(/\.pdf$/i, ""));
  if (key.includes("math")) return normalizeMatiereLabel("Mathématiques");
  if (key.includes("fr") && key.includes("cycle")) return normalizeMatiereLabel("Français");
  if (key.includes("emc")) return normalizeMatiereLabel("EMC");
  if (key.includes("evar")) return normalizeMatiereLabel("EVAR");
  if (key.includes("langues") || key.includes("lv")) return normalizeMatiereLabel("Langues vivantes");
  if (key.includes("histoire") || key.includes("geo")) return normalizeMatiereLabel("Histoire Géographie");
  if (key.includes("sciences")) return normalizeMatiereLabel("Sciences et technologie");
  return null;
}

export function isCycle2ProgrammesFormat(text: string): boolean {
  return TITLE_PATTERN.test(text) || /Programmes\s+scolaires\s+\d{4}\s*[–\-]\s*Cycle\s+2/i.test(text);
}

export function inferCycle2ProgrammesMetadata(
  text: string,
  filename?: string,
): {
  cycle: string;
  matiere: string;
  domaine: string;
  programme: "francais" | "evar" | "emc_moral";
  year: string;
} {
  const titleMatch = text.match(TITLE_PATTERN);
  if (titleMatch) {
    const mapped = normalizeMatiereLabel(titleMatch[3].trim());
    return {
      cycle: titleMatch[2].replace(/\s+/g, " "),
      matiere: mapped.matiere,
      domaine: mapped.domaine,
      programme: mapped.programme,
      year: titleMatch[1],
    };
  }

  if (filename) {
    const fromFile = inferMatiereFromFilename(filename);
    if (fromFile) {
      return { cycle: "Cycle 2", ...fromFile, year: "" };
    }
  }

  return {
    cycle: "Cycle 2",
    matiere: "Français",
    domaine: "Français",
    programme: "francais",
    year: "",
  };
}

function isThreeColumnHeader(line: string): boolean {
  const niveaux = detectAllSchoolNiveauxFromLine(line);
  return niveaux.includes("CP") && niveaux.includes("CE1") && niveaux.includes("CE2");
}

function isSkipLine(line: string): boolean {
  const trimmed = normalizeBoLine(line);
  if (!trimmed) return true;
  if (PAGE_HEADER_PATTERN.test(trimmed)) return true;
  return SKIP_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isAllCapsDomainSection(line: string): boolean {
  const trimmed = normalizeBoLine(line);
  return (
    trimmed.length >= 10 &&
    trimmed.length <= 100 &&
    /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ0-9\s,'()\-–—/]+$/.test(trimmed) &&
    trimmed.includes(" ") &&
    !isThreeColumnHeader(trimmed)
  );
}

function isSubHeadingLine(line: string): boolean {
  if (isAllCapsDomainSection(line)) return false;
  const trimmed = normalizeBoLine(line);
  if (!trimmed || trimmed.length > 120 || trimmed.length < 4) return false;
  if (BULLET_PATTERN.test(trimmed) || SUB_BULLET_PATTERN.test(trimmed)) return false;
  if (MAIN_SECTION_PATTERN.test(trimmed)) return false;
  if (isThreeColumnHeader(trimmed)) return false;
  if (NIVEAU_PREFIX_PATTERN.test(trimmed)) return false;
  if (THEME_PATTERN.test(trimmed)) return false;
  if (PERIOD_MARKER_PATTERN.test(trimmed)) return false;
  if (/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ0-9\s,'()\-–—/]+$/.test(trimmed) && trimmed.length > 20) return true;
  if (/^[A-ZÀÂÄÉÈÊË][a-zàâäéèêëïîôùûüç]/.test(trimmed)) return true;
  return false;
}

function stripBullet(line: string): string {
  return normalizeBoLine(line.replace(BULLET_PATTERN, "").replace(SUB_BULLET_PATTERN, ""));
}

function inferNiveauFromCompetenceContent(text: string): SchoolNiveau | null {
  const key = normalizeBoKey(text);

  if (
    /\bfin cp\b/.test(key) ||
    /\bjusqu.?a cent\b/.test(key) ||
    /\b12 a 15 cgp\b/.test(key) ||
    /\b15 a 30 cgp\b/.test(key) ||
    /\b30 mots par minute\b/.test(key) ||
    /\b15 et 30 mots\b/.test(key) ||
    /\bdechiffrer entre 15 et 30\b/.test(key) ||
    /\bfin de periode 1\b/.test(key) ||
    /\bpremieres semaines\b/.test(key)
  ) {
    return "CP";
  }

  if (
    /\bdix.?mille\b/.test(key) ||
    /\b70 mots\b/.test(key) ||
    /\bquinze de lignes\b/.test(key) ||
    /\b25 a 30 cgp\b/.test(key) ||
    /\b\(a1\)/.test(key) ||
    /\bmilieu d.?annee\b/.test(key)
  ) {
    return "CE1";
  }

  if (
    /\b90 mots\b/.test(key) ||
    /\bvingtaine de lignes\b/.test(key) ||
    /\bdivision\b/.test(key) ||
    /\bmillion\b/.test(key) ||
    /\bdecimaux?\b/.test(key) ||
    /\bperpendiculaire\b/.test(key) ||
    /\bprobabilit/.test(key)
  ) {
    return "CE2";
  }

  return null;
}

function advanceMonotonicNiveau(current: SchoolNiveau, next: SchoolNiveau): SchoolNiveau {
  const order: SchoolNiveau[] = ["CP", "CE1", "CE2"];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function resolveThreeColumnNiveau(text: string, current: SchoolNiveau): SchoolNiveau {
  const inferred = inferNiveauFromCompetenceContent(text);
  if (inferred) {
    return advanceMonotonicNiveau(current, inferred);
  }
  return current;
}

function createParserState(): ParserState {
  return {
    sousMatiere: "",
    sousSousMatiere: "",
    tableTitle: "",
    currentNiveau: "",
    threeColumnMode: false,
    columnNiveau: "CP",
    themeColumnIndex: 0,
    themeNiveauActive: false,
    pendingBullet: "",
    periodContext: "",
    threeColumnBatch: [],
    sortKey: 0,
  };
}

function flushThreeColumnBatch(
  state: ParserState,
  competences: BoFaithfulCompetence[],
  defaults: { cycle: string; matiere: string },
): void {
  if (state.threeColumnBatch.length === 0) return;

  const niveaux = assignNiveauxToBulletBatch(state.threeColumnBatch.map((item) => item.competence));
  for (let index = 0; index < state.threeColumnBatch.length; index += 1) {
    const item = state.threeColumnBatch[index];
    const niveau = niveaux[index] ?? "CP";
    competences.push({
      competence: item.competence,
      hierarchy: {
        cycle: defaults.cycle,
        niveau,
        matiere: defaults.matiere,
        sousMatiere: state.sousMatiere || defaults.matiere,
        sousSousMatiere: state.sousSousMatiere,
      },
      tableTitle: item.tableTitle,
      columnName: niveau,
      tableFormat: "objectifs_exemples",
      sourceExcerpt: item.sourceExcerpt,
      sortKey: item.sortKey,
    });
  }

  state.threeColumnBatch = [];
  state.columnNiveau = "CP";
}

function flushPendingBullet(
  state: ParserState,
  competences: BoFaithfulCompetence[],
  defaults: { cycle: string; matiere: string },
): void {
  if (!state.pendingBullet.trim()) return;

  const competenceText = state.periodContext
    ? `${state.periodContext} ${state.pendingBullet}`.replace(/\s+/g, " ").trim()
    : state.pendingBullet;

  state.sortKey += 1;

  if (state.threeColumnMode && !state.themeNiveauActive && !state.currentNiveau) {
    state.threeColumnBatch.push({
      competence: competenceText,
      tableTitle: state.tableTitle || state.sousMatiere || defaults.matiere,
      sourceExcerpt: competenceText.slice(0, 240),
      sortKey: state.sortKey,
    });
    state.pendingBullet = "";
    state.periodContext = "";
    return;
  }

  let niveau: SchoolNiveau | "" = state.currentNiveau;
  if (state.threeColumnMode && state.themeNiveauActive && state.currentNiveau) {
    niveau = state.currentNiveau;
  } else if (state.threeColumnMode && !state.currentNiveau) {
    niveau = resolveThreeColumnNiveau(state.pendingBullet, state.columnNiveau);
    state.columnNiveau = niveau;
  } else if (!niveau) {
    niveau = inferNiveauFromCompetenceContent(state.pendingBullet) ?? "";
  }

  if (!niveau) return;

  competences.push({
    competence: competenceText,
    hierarchy: {
      cycle: defaults.cycle,
      niveau,
      matiere: defaults.matiere,
      sousMatiere: state.sousMatiere || defaults.matiere,
      sousSousMatiere: state.sousSousMatiere,
    },
    tableTitle: state.tableTitle || state.sousMatiere || defaults.matiere,
    columnName: niveau,
    tableFormat: state.threeColumnMode ? "objectifs_exemples" : "unknown",
    sourceExcerpt: competenceText.slice(0, 240),
    sortKey: state.sortKey,
  });

  state.pendingBullet = "";
  state.periodContext = "";
}

function flushAll(state: ParserState, competences: BoFaithfulCompetence[], defaults: { cycle: string; matiere: string }) {
  flushPendingBullet(state, competences, defaults);
  flushThreeColumnBatch(state, competences, defaults);
}

function parseCycle2ProgrammesText(input: {
  text: string;
  cycle: string;
  matiere: string;
}): BoFaithfulCompetence[] {
  const lines = input.text.split(/\r?\n/);
  const state = createParserState();
  const competences: BoFaithfulCompetence[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = normalizeBoLine(rawLine);

    // Numéro de section ou de page : « 1 » puis titre, ou numéro de page seul.
    if (/^\d+$/.test(line) && line.length <= 2) {
      const nextLine = normalizeBoLine(lines[index + 1] ?? "");
      const isAllCapsTitle =
        !!nextLine &&
        nextLine.length >= 8 &&
        /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ0-9\s,'()\-–—/]+$/.test(nextLine);
      const looksLikeSectionTitle =
        !!nextLine &&
        nextLine.length >= 12 &&
        /^[A-ZÀÂÄÉÈÊËÎÏÔÙ]/.test(nextLine) &&
        (nextLine.includes(":") || isAllCapsTitle);
      const isPageBreakSubHeading =
        !!state.sousMatiere &&
        isAllCapsTitle === false &&
        !!nextLine &&
        nextLine.length < 45 &&
        !nextLine.includes(":") &&
        !/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ0-9\s,'()\-–—/]+$/.test(nextLine);
      const isSectionTitle =
        !!nextLine &&
        !isThreeColumnHeader(nextLine) &&
        !BULLET_PATTERN.test(nextLine) &&
        !isPageBreakSubHeading &&
        (NIVEAU_PREFIX_PATTERN.test(nextLine) ||
          isAllCapsTitle ||
          looksLikeSectionTitle ||
          !state.sousMatiere);

      if (isSectionTitle) {
        flushAll(state, competences, input);
        if (NIVEAU_PREFIX_PATTERN.test(nextLine)) {
          const match = nextLine.match(NIVEAU_PREFIX_PATTERN);
          if (match) {
            state.sousMatiere = normalizeBoLine(match[2]);
            state.tableTitle = state.sousMatiere;
            state.currentNiveau = normalizeSchoolNiveau(match[1]) ?? "";
            state.sousSousMatiere = "";
            state.threeColumnMode = false;
            index += 1;
            continue;
          }
        }
        state.sousMatiere = isAllCapsTitle ? titleCase(nextLine) : normalizeBoLine(nextLine);
        state.tableTitle = state.sousMatiere;
        state.sousSousMatiere = "";
        state.threeColumnMode = false;
        state.themeColumnIndex = 0;
        state.columnNiveau = "CP";
        index += 1;
        continue;
      }

      continue;
    }

    if (isSkipLine(line)) continue;

    if (state.pendingBullet && !BULLET_PATTERN.test(line) && !SUB_BULLET_PATTERN.test(line)) {
      if (
        isSubHeadingLine(line) ||
        isAllCapsDomainSection(line) ||
        isThreeColumnHeader(line) ||
        MAIN_SECTION_PATTERN.test(line) ||
        NIVEAU_PREFIX_PATTERN.test(line) ||
        THEME_PATTERN.test(line) ||
        PAGE_HEADER_PATTERN.test(line)
      ) {
        flushAll(state, competences, input);
      } else if (line.length > 0 && !PERIOD_MARKER_PATTERN.test(line)) {
        state.pendingBullet = `${state.pendingBullet} ${line}`.replace(/\s+/g, " ").trim();
        continue;
      }
    }

    if (isAllCapsDomainSection(line)) {
      flushAll(state, competences, input);
      state.sousMatiere = titleCase(line);
      state.tableTitle = state.sousMatiere;
      state.sousSousMatiere = "";
      state.threeColumnMode = false;
      state.themeColumnIndex = 0;
      state.themeNiveauActive = false;
      state.columnNiveau = "CP";
      continue;
    }

    if (EMC_SECTION_PATTERN.test(line)) {
      flushAll(state, competences, input);
      const match = line.match(EMC_SECTION_PATTERN);
      if (!match) continue;
      const niveau = normalizeSchoolNiveau(match[2]);
      const title = normalizeBoLine(match[3]);
      state.sousMatiere = title;
      state.tableTitle = title;
      state.sousSousMatiere = "";
      state.currentNiveau = niveau ?? "";
      state.threeColumnMode = false;
      state.themeNiveauActive = false;
      state.themeColumnIndex = 0;
      state.columnNiveau = "CP";
      continue;
    }

    if (NIVEAU_PREFIX_PATTERN.test(line)) {
      flushAll(state, competences, input);
      const match = line.match(NIVEAU_PREFIX_PATTERN);
      if (!match) continue;
      const niveau = normalizeSchoolNiveau(match[1]);
      const title = normalizeBoLine(match[2]);
      state.sousMatiere = title;
      state.tableTitle = title;
      state.sousSousMatiere = "";
      state.currentNiveau = niveau ?? "";
      state.threeColumnMode = false;
      state.themeNiveauActive = false;
      continue;
    }

    const mainSection = line.match(MAIN_SECTION_PATTERN);
    if (mainSection && !BULLET_PATTERN.test(line)) {
      const body = normalizeBoLine(mainSection[2]);
      if (/^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(body) && body.length >= 4) {
        flushAll(state, competences, input);
        state.sousMatiere = titleCase(body);
        state.tableTitle = state.sousMatiere;
        state.sousSousMatiere = "";
        state.threeColumnMode = false;
        state.themeColumnIndex = 0;
        state.columnNiveau = "CP";
        continue;
      }
    }

    if (isThreeColumnHeader(line)) {
      flushAll(state, competences, input);
      state.threeColumnMode = true;
      state.currentNiveau = "";
      state.themeNiveauActive = false;
      state.columnNiveau = "CP";
      state.themeColumnIndex = 0;
      continue;
    }

    if (THEME_PATTERN.test(line)) {
      flushAll(state, competences, input);
      if (state.threeColumnMode) {
        state.currentNiveau = CYCLE_2_NIVEAUX[state.themeColumnIndex % CYCLE_2_NIVEAUX.length];
        state.columnNiveau = state.currentNiveau;
        state.themeNiveauActive = true;
        state.themeColumnIndex += 1;
      }
      state.sousSousMatiere = normalizeBoLine(line);
      continue;
    }

    if (PERIOD_MARKER_PATTERN.test(line)) {
      flushPendingBullet(state, competences, input);
      state.periodContext = line.replace(/:\s*$/, "").trim();
      continue;
    }

    if (isSubHeadingLine(line)) {
      flushAll(state, competences, input);
      state.sousSousMatiere = normalizeBoLine(line);
      if (state.threeColumnMode) {
        state.themeNiveauActive = false;
        state.currentNiveau = "";
        state.columnNiveau = "CP";
      }
      continue;
    }

    if (BULLET_PATTERN.test(line) || SUB_BULLET_PATTERN.test(line)) {
      const fragment = stripBullet(line);
      if (state.pendingBullet && SUB_BULLET_PATTERN.test(line)) {
        state.pendingBullet = `${state.pendingBullet} ; ${fragment}`.replace(/\s+/g, " ").trim();
      } else {
        flushPendingBullet(state, competences, input);
        state.pendingBullet = fragment;
      }
      continue;
    }
  }

  flushAll(state, competences, input);
  return competences;
}

function buildTablesFromCompetences(competences: BoFaithfulCompetence[]): BoFaithfulTableReport[] {
  const byTable = new Map<string, BoFaithfulTableReport>();

  for (const item of competences) {
    const key = item.tableTitle || item.hierarchy.sousMatiere || "Programme";
    const existing = byTable.get(key);
    if (existing) {
      existing.competencesExtracted += 1;
    } else {
      byTable.set(key, {
        tableTitle: key,
        tableFormat: item.tableFormat,
        columnName: item.columnName,
        competencesExtracted: 1,
        warnings: [],
      });
    }
  }

  return [...byTable.values()];
}

export function extractCycle2Programmes(input: {
  text: string;
  cycle: string;
  matiere: string;
}): BoFaithfulExtractionResult & { toReview: import("./niveau-separation").BoCompetenceReviewItem[] } {
  const rawCompetences = parseCycle2ProgrammesText(input);
  const separation = finalizeCompetencesWithStrictNiveau(rawCompetences, {
    cycle: input.cycle,
    documentNiveaux: "CP,CE1,CE2",
  });

  const tables = buildTablesFromCompetences(separation.confirmed);
  const competencesBySousMatiere: Record<string, number> = {};
  const competencesByNiveau: Record<string, number> = { ...separation.competencesByNiveau };

  for (const item of separation.confirmed) {
    const key = item.hierarchy.sousMatiere || "Non précisé";
    competencesBySousMatiere[key] = (competencesBySousMatiere[key] ?? 0) + 1;
  }

  const warnings = [...separation.warnings];
  if (separation.confirmed.length === 0) {
    warnings.push("Aucune compétence extraite — vérifiez le format Programmes Cycle 2.");
  }

  const introductionEnd = input.text.search(/\n\s*1\s+[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/);
  const introduction = introductionEnd > 0 ? input.text.slice(0, introductionEnd).trim() : "";
  const structuredText = introductionEnd > 0 ? input.text.slice(introductionEnd).trim() : input.text.trim();

  return {
    introduction,
    structuredText,
    competences: separation.confirmed,
    toReview: separation.toReview,
    quality: {
      introductionCharCount: introduction.length,
      structuredCharCount: structuredText.length,
      totalCompetences: separation.confirmed.length,
      tablesDetected: tables.length,
      tablesProcessed: tables.filter((table) => table.competencesExtracted > 0).length,
      competencesByMatiere: { [input.matiere]: separation.confirmed.length },
      competencesBySousMatiere,
      competencesBySousSousMatiere: {},
      competencesByNiveau,
      competencesToReview: separation.toReview.length,
      tables,
      warnings,
      passed: separation.confirmed.length > 0,
    },
    extractionMethod: "cycle2_programmes_v1",
  };
}
