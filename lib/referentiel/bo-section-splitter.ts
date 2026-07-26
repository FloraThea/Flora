import { BO_EVAR_SECTIONS } from "./bo-emc-sections";
import type { BoSectionChunk, BoSectionDefinition, BoSectionId } from "./bo-types";
import { BO_FRANCAIS_SECTIONS } from "./bo-types";

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findAnchorPosition(text: string, anchor: string): number {
  const normalizedText = normalizeForMatch(text);
  const normalizedAnchor = normalizeForMatch(anchor);
  return normalizedText.indexOf(normalizedAnchor);
}

function findBestSectionStart(
  text: string,
  section: BoSectionDefinition,
  afterIndex: number,
): number | null {
  let best: number | null = null;

  for (const anchor of section.anchors) {
    const fromSlice = text.slice(afterIndex);
    const relative = findAnchorPosition(fromSlice, anchor);
    if (relative === -1) continue;
    const absolute = afterIndex + relative;
    if (best === null || absolute < best) {
      best = absolute;
    }
  }

  return best;
}

export type BoProgrammeKind = "francais" | "evar" | "emc_moral";

export function inferBoMetadata(text: string): {
  cycle: string;
  matiere: string;
  domaine: string;
  programme: BoProgrammeKind;
} {
  const normalized = normalizeForMatch(text);

  let cycle = "";
  if (normalized.includes("cycle 3")) cycle = "Cycle 3";
  else if (normalized.includes("cycle 2")) cycle = "Cycle 2";
  else if (normalized.includes("cycle 1")) cycle = "Cycle 1";
  else if (normalized.includes("ecole elementaire")) cycle = "Cycle 2";

  let matiere = "Français";
  let programme: BoProgrammeKind = "francais";
  let domaine = "Français";

  if (
    normalized.includes("education a la vie affective") ||
    normalized.includes("vie affective et relationnelle") ||
    normalized.includes("evar") ||
    normalized.includes("education a la sexualite")
  ) {
    matiere = "EMC";
    programme = "evar";
    domaine = "Éducation à la vie affective et relationnelle";
  } else if (
    normalized.includes("enseignement moral et civique") ||
    normalized.includes("moral et civique")
  ) {
    matiere = "EMC";
    programme = "emc_moral";
    domaine = "Enseignement moral et civique";
  } else if (normalized.includes("mathematiques") || normalized.includes("mathematique")) {
    matiere = "Mathématiques";
    domaine = "Mathématiques";
  } else if (normalized.includes("francais")) {
    matiere = "Français";
    domaine = "Français";
  }

  return {
    cycle,
    matiere,
    programme,
    domaine,
  };
}

export function resolveProgrammeKind(input: {
  text: string;
  matiere?: string;
  domaine?: string;
  programme?: BoProgrammeKind;
}): BoProgrammeKind {
  if (input.programme) return input.programme;

  const normalizedDomaine = normalizeForMatch(input.domaine ?? "");
  if (normalizedDomaine.includes("moral et civique") || normalizedDomaine.includes("enseignement moral")) {
    return "emc_moral";
  }
  if (
    normalizedDomaine.includes("vie affective") ||
    normalizedDomaine.includes("evar") ||
    normalizedDomaine.includes("sexualite")
  ) {
    return "evar";
  }

  const normalizedMatiere = normalizeForMatch(input.matiere ?? "");
  const normalizedText = normalizeForMatch(input.text);
  if (normalizedMatiere.includes("emc")) {
    if (normalizedText.includes("enseignement moral et civique")) return "emc_moral";
    if (
      normalizedText.includes("education a la vie affective") ||
      normalizedText.includes("vie affective et relationnelle")
    ) {
      return "evar";
    }
  }

  return inferBoMetadata(input.text).programme;
}

export function resolveBoSectionCatalog(text: string): BoSectionDefinition[] {
  const programme = inferBoMetadata(text).programme;
  return programme === "evar" || programme === "emc_moral" ? BO_EVAR_SECTIONS : BO_FRANCAIS_SECTIONS;
}

export function splitBoTextIntoSections(
  text: string,
  sections?: BoSectionDefinition[],
): BoSectionChunk[] {
  const catalog = sections ?? resolveBoSectionCatalog(text);
  const introSection = catalog[0];
  const hits: Array<{ section: BoSectionDefinition; start: number }> = [];

  for (const section of catalog) {
    if (section.id === introSection.id) continue;
    const start = findBestSectionStart(text, section, 0);
    if (start !== null) {
      hits.push({ section, start });
    }
  }

  hits.sort((a, b) => a.start - b.start);

  const uniqueHits: typeof hits = [];
  for (const hit of hits) {
    const duplicate = uniqueHits.find((item) => item.section.id === hit.section.id);
    if (!duplicate) uniqueHits.push(hit);
  }

  if (uniqueHits.length === 0) {
    return [
      {
        id: introSection.id,
        label: introSection.label,
        text,
        charStart: 0,
        charEnd: text.length,
      },
    ];
  }

  const chunks: BoSectionChunk[] = [];
  const introEnd = uniqueHits[0].start;

  if (introEnd > 0) {
    chunks.push({
      id: introSection.id,
      label: introSection.label,
      text: text.slice(0, introEnd).trim(),
      charStart: 0,
      charEnd: introEnd,
    });
  }

  for (let index = 0; index < uniqueHits.length; index += 1) {
    const current = uniqueHits[index];
    const next = uniqueHits[index + 1];
    const start = current.start;
    const end = next ? next.start : text.length;
    const slice = text.slice(start, end).trim();

    if (slice.length > 80) {
      chunks.push({
        id: current.section.id,
        label: current.section.label,
        text: slice,
        charStart: start,
        charEnd: end,
      });
    }
  }

  return chunks.filter((chunk) => chunk.text.trim().length > 0);
}

export function chunkSectionText(text: string, maxChars = 14000): string[] {
  if (text.length <= maxChars) return [text];

  const parts: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    parts.push(text.slice(cursor, cursor + maxChars));
    cursor += maxChars;
  }

  return parts;
}

export function sectionIdFromLabel(label: string): BoSectionId {
  const catalogs = [...BO_FRANCAIS_SECTIONS, ...BO_EVAR_SECTIONS];
  const match = catalogs.find(
    (section) => normalizeForMatch(section.label) === normalizeForMatch(label),
  );
  return match?.id ?? "francais";
}
