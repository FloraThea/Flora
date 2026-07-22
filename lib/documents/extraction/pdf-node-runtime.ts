import { createRequire } from "node:module";
import path from "node:path";

/**
 * Runtime PDF Node pour Flora (Vercel / Serverless).
 *
 * - `import("pdf-parse")` : bundlé par Next.js dans les chunks serveur (pas de node_modules runtime).
 * - Polyfills canvas via require ancré sur process.cwd() pour @napi-rs/canvas (module natif externalisé).
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
let pdfParseModulePromise: Promise<PdfParseModule> | null = null;

function getRootRequire() {
  return createRequire(path.join(process.cwd(), "package.json"));
}

function installNodePdfPolyfills(): void {
  if (polyfillsInstalled) return;

  if (
    typeof globalThis.DOMMatrix === "undefined" ||
    typeof globalThis.ImageData === "undefined" ||
    typeof globalThis.Path2D === "undefined"
  ) {
    try {
      const canvas = getRootRequire()("@napi-rs/canvas") as {
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

async function loadPdfParseModule(): Promise<PdfParseModule> {
  if (!pdfParseModulePromise) {
    pdfParseModulePromise = (async () => {
      installNodePdfPolyfills();

      // Import dynamique : inclus dans le bundle serveur Next (évite « Cannot find module » sur Vercel).
      try {
        return (await import("pdf-parse")) as PdfParseModule;
      } catch (importError) {
        try {
          return getRootRequire()("pdf-parse") as PdfParseModule;
        } catch (requireError) {
          const importMessage =
            importError instanceof Error ? importError.message : String(importError);
          const requireMessage =
            requireError instanceof Error ? requireError.message : String(requireError);
          throw new Error(
            `Impossible de charger pdf-parse (import: ${importMessage}; require: ${requireMessage})`,
          );
        }
      }
    })();
  }

  return pdfParseModulePromise;
}

export async function createNodePdfParser(buffer: Buffer): Promise<FloraPdfParser> {
  const { PDFParse } = await loadPdfParseModule();
  return new PDFParse({ data: buffer });
}
