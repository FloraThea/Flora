import { IMPORT_CONFIG } from "./config";
import { extractTextFromBuffer } from "../extract-text";

export class OCRService {
  shouldRunOcr(extractedText: string, extension: string): boolean {
    if (!IMPORT_CONFIG.ocr.enabled) return false;
    if (extension !== ".pdf") return false;
    const trimmed = extractedText.trim();
    if (trimmed.length >= 500) return false;
    const alphaRatio =
      (trimmed.match(/[a-zA-ZÀ-ÿ]/g)?.length ?? 0) / Math.max(trimmed.length, 1);
    return alphaRatio < 0.25;
  }

  async extractFromPdfBuffer(buffer: Buffer): Promise<{
    text: string;
    usedOcr: boolean;
    pageCount: number | null;
  }> {
    try {
      const { extractPdfBuffer } = await import("../extraction/pdf-extractor");
      const result = await extractPdfBuffer(buffer);
      return {
        text: result.text,
        usedOcr: Boolean(result.usedOcr),
        pageCount: result.pageCount,
      };
    } catch {
      return { text: "", usedOcr: false, pageCount: null };
    }
  }

  mergeWithNativeText(nativeText: string, ocrText: string): string {
    const native = nativeText.trim();
    const ocr = ocrText.trim();
    if (!native) return ocr;
    if (!ocr) return native;
    if (native.length > ocr.length * 1.5) return native;
    return `${native}\n\n--- OCR ---\n\n${ocr}`;
  }
}

export const ocrService = new OCRService();
