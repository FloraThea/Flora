import type { TextChunkDraft } from "@/lib/documents/types";
import type { ParsedResource } from "./types";

const HEADING_PATTERN = /^(?:#{1,6}\s+|[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 \-'’]{2,80}$|\d+(?:\.\d+)*[\.)]\s+.)/;

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
}

function detectSectionType(line: string, hierarchy: string[], level: number): string {
  const normalized = line.toLowerCase();

  for (const type of hierarchy) {
    if (normalized.includes(type.replace("_", " "))) return type;
  }

  if (/comp[eé]tence/i.test(normalized)) return "competence";
  if (/objectif/i.test(normalized)) return "objectif";
  if (/s[eé]ance/i.test(normalized)) return "seance";
  if (/module/i.test(normalized)) return "module";
  if (/activit[eé]/i.test(normalized)) return "activite";
  if (/domaine/i.test(normalized)) return "domaine";
  if (/attendu/i.test(normalized)) return "attendu";
  if (/personnage/i.test(normalized)) return "personnage";
  if (/vocabulaire|lexique/i.test(normalized)) return "lexique";

  return hierarchy[Math.min(level, hierarchy.length - 1)] ?? "section";
}

/**
 * Découpe un document selon sa structure pédagogique détectée.
 */
export class ChunkManager {
  buildSmartChunks(text: string, parsedResource: ParsedResource): TextChunkDraft[] {
    const normalized = normalizeWhitespace(text);
    if (!normalized) return [];

    const lines = normalized.split("\n");
    const hierarchy = parsedResource.hierarchyTemplate;
    const chunks: TextChunkDraft[] = [];
    let currentTitle = "Introduction";
    let currentType = hierarchy[0] ?? "section";
    let currentLevel = 0;
    let buffer: string[] = [];
    let chunkIndex = 0;
    let hierarchyPath: string[] = [];

    const flush = () => {
      const content = buffer.join("\n").trim();
      if (!content) return;

      chunks.push({
        chunk_index: chunkIndex,
        title: currentTitle,
        content,
        page_start: null,
        page_end: null,
        section_type: currentType,
        metadata: {
          hierarchy_path: [...hierarchyPath],
          level: currentLevel,
          parser: "ChunkManager",
        },
      });
      chunkIndex += 1;
      buffer = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        buffer.push("");
        continue;
      }

      const isHeading = HEADING_PATTERN.test(trimmed);
      if (isHeading && buffer.length > 0) {
        flush();
      }

      if (isHeading) {
        currentTitle = trimmed.replace(/^#{1,6}\s+/, "").slice(0, 120);
        currentLevel = trimmed.startsWith("#")
          ? (trimmed.match(/^#+/)?.[0].length ?? 1) - 1
          : currentLevel + 1;
        currentType = detectSectionType(trimmed, hierarchy, currentLevel);
        hierarchyPath = hierarchy.slice(0, currentLevel + 1);
        buffer = [trimmed];
        continue;
      }

      buffer.push(trimmed);
    }

    flush();
    return chunks.length > 0 ? chunks : this.buildFallbackChunks(normalized);
  }

  private buildFallbackChunks(text: string): TextChunkDraft[] {
    const paragraphs = text.split(/\n{2,}/).filter(Boolean);
    return paragraphs.map((paragraph, index) => ({
      chunk_index: index,
      title: paragraph.split("\n")[0]?.slice(0, 80) ?? `Section ${index + 1}`,
      content: paragraph.trim(),
      page_start: null,
      page_end: null,
      section_type: "text",
      metadata: { parser: "ChunkManager", fallback: true },
    }));
  }
}

export const chunkManager = new ChunkManager();
