import { jsPDF } from "jspdf";
import type { PageDimensions, PrintOrientation } from "./types";
import { A4_LANDSCAPE_PX, A4_PORTRAIT_PX } from "./types";

export function getPageDimensions(orientation: PrintOrientation): PageDimensions {
  return orientation === "portrait" ? A4_PORTRAIT_PX : A4_LANDSCAPE_PX;
}

/**
 * Generates a print-quality PDF (300 dpi equivalent) from a rendered print-layout image.
 * The source is the dedicated SchedulePrintLayout — never the interactive grid.
 */
export class PdfGenerator {
  static async fromImageDataUrl(
    dataUrl: string,
    orientation: PrintOrientation,
    filename: string,
  ): Promise<void> {
    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = orientation === "portrait" ? 210 : 297;
    const pageHeight = orientation === "portrait" ? 297 : 210;

    pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "SLOW");
    pdf.save(filename);
  }
}
