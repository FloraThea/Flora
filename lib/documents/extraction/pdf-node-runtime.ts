import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Charge pdf-parse via le build CJS Node (legacy pdf.js inliné).
 * Évite la résolution ESM/browser de pdfjs-dist/build/pdf.mjs qui exige DOMMatrix.
 */
export type FloraPdfParser = {
  getInfo: () => Promise<{
    total?: number;
    info?: Record<string, unknown>;
    permission?: unknown;
  }>;
  getText: (params?: Record<string, unknown>) => Promise<{
    text?: string;
    total?: number;
    pages?: Array<{ num?: number; text?: string }>;
  }>;
  getScreenshot: (params?: {
    scale?: number;
    imageBuffer?: boolean;
    imageDataUrl?: boolean;
  }) => Promise<{
    pages: Array<{ pageNumber: number; data: Uint8Array }>;
  }>;
  destroy: () => Promise<void>;
};

type PdfParseModule = {
  PDFParse: new (options: { data: Buffer | Uint8Array }) => FloraPdfParser;
};

let polyfillsInstalled = false;
let pdfParseModule: PdfParseModule | null = null;

function installNodePdfPolyfills(): void {
  if (polyfillsInstalled) return;

  if (
    typeof globalThis.DOMMatrix === "undefined" ||
    typeof globalThis.ImageData === "undefined" ||
    typeof globalThis.Path2D === "undefined"
  ) {
    try {
      const require = createRequire(fileURLToPath(import.meta.url));
      const canvas = require("@napi-rs/canvas") as {
        DOMMatrix?: typeof DOMMatrix;
        ImageData?: typeof ImageData;
        Path2D?: typeof Path2D;
      };

      if (typeof globalThis.DOMMatrix === "undefined" && canvas.DOMMatrix) {
        globalThis.DOMMatrix = canvas.DOMMatrix;
      }
      if (typeof globalThis.ImageData === "undefined" && canvas.ImageData) {
        globalThis.ImageData = canvas.ImageData;
      }
      if (typeof globalThis.Path2D === "undefined" && canvas.Path2D) {
        globalThis.Path2D = canvas.Path2D;
      }
    } catch {
      // Extraction texte native OK sans canvas ; rendu OCR nécessite @napi-rs/canvas.
    }
  }

  polyfillsInstalled = true;
}

function loadPdfParseModule(): PdfParseModule {
  if (!pdfParseModule) {
    installNodePdfPolyfills();
    const require = createRequire(fileURLToPath(import.meta.url));
    pdfParseModule = require("pdf-parse") as PdfParseModule;
  }
  return pdfParseModule;
}

export async function createNodePdfParser(buffer: Buffer): Promise<FloraPdfParser> {
  const { PDFParse } = loadPdfParseModule();
  return new PDFParse({ data: buffer });
}
