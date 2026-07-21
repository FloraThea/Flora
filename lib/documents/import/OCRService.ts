import { IMPORT_CONFIG } from "./config";

/**
 * Complément OCR conservé pour compatibilité.
 * L'extraction PDF principale gère déjà le basculement OCR dans `extractPdfBuffer`.
 */
export class OCRService {
  shouldRunOcr(_extractedText: string, _extension: string): boolean {
    return false;
  }

  async extractFromPdfBuffer(_buffer: Buffer): Promise<{
    text: string;
    usedOcr: boolean;
    pageCount: number | null;
  }> {
    if (!IMPORT_CONFIG.ocr.enabled) {
      return { text: "", usedOcr: false, pageCount: null };
    }

    return { text: "", usedOcr: false, pageCount: null };
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
