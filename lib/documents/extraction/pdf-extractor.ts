import "server-only";

import { serializeError } from "@/lib/api/error-diagnostics";
import {
  DocumentExtractionError,
  isInvalidPdfError,
  isPasswordProtectedError,
} from "./errors";
import { extractPdfTextWithOcr } from "./ocr-extractor";
import type { DocumentExtractionResult } from "./types";

const PREVIEW_LENGTH = 500;
const MIN_TOTAL_CHARS = 80;
const MIN_CHARS_PER_PAGE = 35;
const OCR_SCALE = 2;

type PdfScreenshot = {
  pageNumber: number;
  data: Uint8Array;
};

function buildPreview(text: string): string {
  return text.slice(0, PREVIEW_LENGTH);
}

function normalizeText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\s+\n/g, "\n").trim();
}

function isLikelyScannedPdf(text: string, pageCount: number): boolean {
  if (!text.trim()) return true;
  if (pageCount <= 0) return text.trim().length < MIN_TOTAL_CHARS;

  const charsPerPage = text.trim().length / pageCount;
  return text.trim().length < MIN_TOTAL_CHARS || charsPerPage < MIN_CHARS_PER_PAGE;
}

async function loadPdfParser(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  return new PDFParse({ data: buffer });
}

async function capturePageScreenshots(
  parser: {
    getScreenshot: (params?: {
      scale?: number;
      imageBuffer?: boolean;
      imageDataUrl?: boolean;
    }) => Promise<{
      pages: Array<{ pageNumber: number; data: Uint8Array }>;
    }>;
  },
  pageCount: number,
): Promise<PdfScreenshot[]> {
  const screenshots = await parser.getScreenshot({
    scale: OCR_SCALE,
    imageBuffer: true,
    imageDataUrl: false,
  });

  return screenshots.pages
    .filter((page) => page.data && page.data.length > 0)
    .map((page) => ({
      pageNumber: page.pageNumber,
      data: page.data,
    }))
    .slice(0, pageCount);
}

export async function extractPdfBuffer(buffer: Buffer): Promise<DocumentExtractionResult> {
  let parser: Awaited<ReturnType<typeof loadPdfParser>> | null = null;

  try {
    parser = await loadPdfParser(buffer);

    const info = await parser.getInfo();
    const pageCount = info.total ?? 0;

    const textResult = await parser.getText({
      parseHyperlinks: false,
      lineEnforce: true,
    });

    let text = normalizeText(textResult.text ?? "");
    let extractionMethod: DocumentExtractionResult["extractionMethod"] = "pdf-text";
    let usedOcr = false;

    if (isLikelyScannedPdf(text, pageCount)) {
      console.info("[pdf-extractor] Texte natif insuffisant, bascule OCR", {
        pageCount,
        textLength: text.length,
        charsPerPage: pageCount > 0 ? Math.round(text.length / pageCount) : null,
      });

      const screenshots = await capturePageScreenshots(parser, pageCount);

      if (screenshots.length === 0) {
        throw new DocumentExtractionError(
          "Le PDF semble être une image scannée, mais aucune page n'a pu être rendue pour l'OCR.",
          {
            reason: "scanned_pdf",
            pageCount,
            textLength: text.length,
            preview: buildPreview(text),
          },
        );
      }

      const ocrResult = await extractPdfTextWithOcr(screenshots, {
        maxPages: pageCount,
      });

      text = normalizeText(ocrResult.text);
      extractionMethod = "pdf-ocr";
      usedOcr = true;

      console.info("[pdf-extractor] OCR terminé", {
        pageCount,
        pagesProcessed: ocrResult.pagesProcessed,
        textLength: text.length,
      });
    }

    if (!text) {
      throw new DocumentExtractionError(
        "Aucun texte n'a pu être extrait de ce PDF. Il s'agit probablement d'un document scanné de mauvaise qualité, protégé ou corrompu.",
        {
          reason: pageCount > 0 ? "scanned_pdf" : "empty_document",
          pageCount,
          textLength: 0,
          preview: "",
        },
      );
    }

    const charsPerPage = pageCount > 0 ? Math.round(text.length / pageCount) : null;

    return {
      text,
      pageCount,
      textLength: text.length,
      preview: buildPreview(text),
      extractionMethod,
      usedOcr,
      charsPerPage,
    };
  } catch (error) {
    if (error instanceof DocumentExtractionError) {
      throw error;
    }

    if (isPasswordProtectedError(error)) {
      throw new DocumentExtractionError(
        "Ce PDF est protégé par un mot de passe. Déposez une version non protégée du document officiel.",
        {
          reason: "password_protected",
          cause: error,
        },
      );
    }

    if (isInvalidPdfError(error)) {
      throw new DocumentExtractionError(
        "Le fichier PDF est corrompu ou n'est pas un PDF valide.",
        {
          reason: "corrupted_pdf",
          cause: error,
        },
      );
    }

    console.error("[pdf-extractor] Echec extraction PDF", serializeError(error));

    throw new DocumentExtractionError(
      "Impossible d'extraire le texte de ce PDF. Le fichier peut être corrompu, protégé ou composé uniquement d'images non lisibles.",
      {
        reason: "parser_error",
        cause: error,
      },
    );
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
}
