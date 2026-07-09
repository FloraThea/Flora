import type { TextChunkDraft } from "./types";

const DEFAULT_CHUNK_SIZE = 1800;

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
}

function splitIntoParagraphs(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function chunkDocumentText(
  text: string,
  maxChunkSize = DEFAULT_CHUNK_SIZE,
): TextChunkDraft[] {
  const normalized = normalizeWhitespace(text);

  if (!normalized) {
    return [];
  }

  const paragraphs = splitIntoParagraphs(normalized);
  const chunks: TextChunkDraft[] = [];
  let buffer = "";
  let chunkIndex = 0;

  const pushChunk = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const firstLine = trimmed.split("\n")[0]?.slice(0, 80) ?? "Section";
    chunks.push({
      chunk_index: chunkIndex,
      title: firstLine,
      content: trimmed,
      page_start: null,
      page_end: null,
      section_type: "text",
      metadata: {},
    });
    chunkIndex += 1;
  };

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChunkSize) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      pushChunk(buffer);
      buffer = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += maxChunkSize) {
      pushChunk(paragraph.slice(index, index + maxChunkSize));
    }
    buffer = "";
  }

  if (buffer) {
    pushChunk(buffer);
  }

  return chunks;
}
