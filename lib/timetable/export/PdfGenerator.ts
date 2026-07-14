import { jsPDF } from "jspdf";
import type { PageDimensions, PageFormat, PrintOrientation } from "./types";
import { resolvePageDimensions } from "./types";

export function getPageDimensions(
  orientation: PrintOrientation,
  pageFormat: PageFormat = "a4",
): PageDimensions {
  return resolvePageDimensions({ orientation, pageFormat });
}

const PDF_MM: Record<PageFormat, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a3: { w: 297, h: 420 },
};

/**
 * PDF haute définition depuis la vue d'impression dédiée (SchedulePrintLayout).
 */
export class PdfGenerator {
  static async fromImageDataUrl(
    dataUrl: string,
    orientation: PrintOrientation,
    filename: string,
    pageFormat: PageFormat = "a4",
  ): Promise<void> {
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: pageFormat,
      compress: true,
    });

    const base = PDF_MM[pageFormat];
    const pageWidth = orientation === "portrait" ? base.w : base.h;
    const pageHeight = orientation === "portrait" ? base.h : base.w;

    pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "SLOW");
    pdf.save(filename);
  }
}
