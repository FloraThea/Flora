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
  const index = normalizedText.indexOf(normalizedAnchor);
  return index;
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

export function splitBoTextIntoSections(
  text: string,
  sections: BoSectionDefinition[] = BO_FRANCAIS_SECTIONS,
): BoSectionChunk[] {
  const hits: Array<{ section: BoSectionDefinition; start: number }> = [];

  for (const section of sections) {
    if (section.id === "francais") continue;
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

  const chunks: BoSectionChunk[] = [];

  if (uniqueHits.length === 0) {
    chunks.push({
      id: "francais",
      label: "Français",
      text,
      charStart: 0,
      charEnd: text.length,
    });
    return chunks;
  }

  const introEnd = uniqueHits[0].start;
  if (introEnd > 0) {
    chunks.push({
      id: "francais",
      label: "Français",
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

export function inferBoMetadata(text: string): {
  cycle: string;
  matiere: string;
  domaine: string;
} {
  const normalized = normalizeForMatch(text);

  let cycle = "";
  if (normalized.includes("cycle 2")) cycle = "Cycle 2";
  else if (normalized.includes("cycle 3")) cycle = "Cycle 3";
  else if (normalized.includes("cycle 1")) cycle = "Cycle 1";

  let matiere = "Français";
  if (
    normalized.includes("education a la vie affective") ||
    normalized.includes("vie affective et relationnelle") ||
    normalized.includes("evar")
  ) {
    matiere = "EMC";
  } else if (normalized.includes("mathematiques") || normalized.includes("mathematique")) {
    matiere = "Mathématiques";
  } else if (normalized.includes("francais")) {
    matiere = "Français";
  }

  return {
    cycle,
    matiere,
    domaine: matiere === "EMC" ? "Éducation morale et civique" : matiere === "Français" ? "Français" : matiere,
  };
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
  const match = BO_FRANCAIS_SECTIONS.find(
    (section) => normalizeForMatch(section.label) === normalizeForMatch(label),
  );
  return match?.id ?? "francais";
}
