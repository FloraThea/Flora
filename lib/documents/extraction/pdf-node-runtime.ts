import { createRequire } from "node:module";
import path from "node:path";
import { installPdfDomPolyfills } from "./pdf-dom-polyfills";

/**
 * Runtime PDF Node pour Flora (Vercel / Serverless).
 *
 * Charge pdf-parse via le build CJS (legacy pdf.js inliné) avec require().
 * Ne pas utiliser import("pdf-parse") : Turbopack résout parfois pdfjs-dist/build
 * (navigateur) → DOMMatrix is not defined sur Vercel.
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

let pdfParseModule: PdfParseModule | null = null;

function getRootRequire() {
  return createRequire(path.join(process.cwd(), "package.json"));
}

function loadPdfParseModule(): PdfParseModule {
  if (!pdfParseModule) {
    installPdfDomPolyfills();
    pdfParseModule = getRootRequire()("pdf-parse") as PdfParseModule;
  }
  return pdfParseModule;
}

export async function createNodePdfParser(buffer: Buffer): Promise<FloraPdfParser> {
  const { PDFParse } = loadPdfParseModule();
  return new PDFParse({ data: buffer });
}

/** Référence statique pour le file-tracer Vercel (inclusion node_modules). */
export const PDF_PARSE_PACKAGE_NAME = "pdf-parse";
