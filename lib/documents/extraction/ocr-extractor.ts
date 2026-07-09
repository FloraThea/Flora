import "server-only";

import { createWorker, type Worker } from "tesseract.js";

const OCR_LANGUAGE = "fra";
const MAX_OCR_PAGES = 60;

let workerPromise: Promise<Worker> | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker(OCR_LANGUAGE);
      return worker;
    })();
  }

  return workerPromise;
}

export async function recognizeImageBuffer(image: Uint8Array): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(Buffer.from(image));
  return data.text ?? "";
}

export async function extractPdfTextWithOcr(
  screenshots: Array<{ pageNumber: number; data: Uint8Array }>,
  options?: { maxPages?: number },
): Promise<{ text: string; pagesProcessed: number }> {
  const maxPages = options?.maxPages ?? MAX_OCR_PAGES;
  const pages = screenshots.slice(0, maxPages);
  const chunks: string[] = [];

  for (const page of pages) {
    const pageText = (await recognizeImageBuffer(page.data)).trim();
    if (pageText) {
      chunks.push(pageText);
    }
  }

  return {
    text: chunks.join("\n\n"),
    pagesProcessed: pages.length,
  };
}
