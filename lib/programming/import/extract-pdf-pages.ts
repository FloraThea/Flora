import "server-only";

import { recognizeImageBuffer } from "@/lib/documents/extraction/ocr-extractor";

function normalizeText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\s+\n/g, "\n").trim();
}

async function loadPdfParser(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  return new PDFParse({ data: buffer });
}

export async function extractPdfPageTexts(buffer: Buffer): Promise<string[]> {
  const parser = await loadPdfParser(buffer);

  try {
    const info = await parser.getInfo();
    const pageCount = Math.max(1, info.total ?? 1);

    const textResult = await parser.getText({
      parseHyperlinks: false,
      lineEnforce: true,
    });

    const pagesResult = textResult as { pages?: Array<{ text?: string }>; text?: string };
    if (Array.isArray(pagesResult.pages) && pagesResult.pages.length > 0) {
      const pageTexts = pagesResult.pages
        .map((page) => normalizeText(page.text ?? ""))
        .filter(Boolean);
      if (pageTexts.length > 0) return pageTexts;
    }

    const fullText = normalizeText(pagesResult.text ?? "");
    const byFormFeed = fullText.split(/\f+/).map(normalizeText).filter(Boolean);
    if (byFormFeed.length >= pageCount && byFormFeed.length > 1) {
      return byFormFeed.slice(0, pageCount);
    }

    if (pageCount === 1) {
      return fullText ? [fullText] : [];
    }

    const screenshots = await parser.getScreenshot({
      scale: 2,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const pageTexts: string[] = [];
    for (const page of screenshots.pages.slice(0, pageCount)) {
      if (!page.data?.length) continue;
      const text = normalizeText(await recognizeImageBuffer(page.data));
      if (text) pageTexts.push(text);
    }

    if (pageTexts.length > 0) return pageTexts;
    return fullText ? [fullText] : [];
  } finally {
    await parser.destroy();
  }
}
