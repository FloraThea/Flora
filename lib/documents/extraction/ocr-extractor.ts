import "server-only";

import { createWorker, type Worker } from "tesseract.js";

const OCR_LANGUAGE = "fra";
const MAX_OCR_PAGES = 60;
const OCR_TIMEOUT_MS = 90_000;

let workerPromise: Promise<Worker> | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

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
  const { data } = await withTimeout(
    worker.recognize(Buffer.from(image)),
    OCR_TIMEOUT_MS,
    "L'analyse OCR a dépassé le délai autorisé (90 s). Réessayez avec une image plus légère ou un export Excel.",
  );
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
