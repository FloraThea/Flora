import { toJpeg, toPng } from "html-to-image";
import type { ExportFormat, PageFormat, PrintOrientation } from "./types";
import { getPageDimensions } from "./PdfGenerator";
import { PdfGenerator } from "./PdfGenerator";
import { PRINT_FONT_URL } from "./print-theme";

const CAPTURE_OPTIONS = {
  cacheBust: true,
  backgroundColor: "#ffffff",
  pixelRatio: 1,
};

async function waitForFonts(): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export type ExportOptions = {
  orientation: PrintOrientation;
  pageFormat?: PageFormat;
};

/**
 * Export depuis la vue d'impression dédiée — jamais depuis la grille interactive.
 */
export class ExportService {
  static async renderLayoutToPng(
    element: HTMLElement,
    options: ExportOptions,
  ): Promise<string> {
    await waitForFonts();
    const { width, height } = getPageDimensions(options.orientation, options.pageFormat ?? "a4");

    return toPng(element, {
      ...CAPTURE_OPTIONS,
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: "none",
      },
    });
  }

  static async exportPdf(
    element: HTMLElement,
    options: ExportOptions,
    filename: string,
  ): Promise<void> {
    const pageFormat = options.pageFormat ?? "a4";
    const dataUrl = await this.renderLayoutToPng(element, options);
    await PdfGenerator.fromImageDataUrl(dataUrl, options.orientation, filename, pageFormat);
  }

  static async exportPng(
    element: HTMLElement,
    options: ExportOptions,
    filename: string,
  ): Promise<void> {
    await waitForFonts();
    const { width, height } = getPageDimensions(options.orientation, options.pageFormat ?? "a4");
    const dataUrl = await toPng(element, { ...CAPTURE_OPTIONS, width, height });
    downloadBlob(dataUrlToBlob(dataUrl), filename);
  }

  static async exportJpeg(
    element: HTMLElement,
    options: ExportOptions,
    filename: string,
  ): Promise<void> {
    await waitForFonts();
    const { width, height } = getPageDimensions(options.orientation, options.pageFormat ?? "a4");
    const dataUrl = await toJpeg(element, {
      ...CAPTURE_OPTIONS,
      width,
      height,
      quality: 0.95,
    });
    downloadBlob(dataUrlToBlob(dataUrl), filename);
  }

  static printLayout(element: HTMLElement, options: ExportOptions): void {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!printWindow) {
      throw new Error("Impossible d'ouvrir la fenêtre d'impression.");
    }

    const pageFormat = options.pageFormat ?? "a4";
    const pageSize =
      options.orientation === "landscape"
        ? `${pageFormat.toUpperCase()} landscape`
        : `${pageFormat.toUpperCase()} portrait`;
    const clone = element.cloneNode(true) as HTMLElement;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Emploi du temps — Flora</title>
      <link href="${PRINT_FONT_URL}" rel="stylesheet" />
      <style>
        @page { size: ${pageSize}; margin: 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html, body { margin: 0; padding: 0; background: white; }
        body { display: flex; justify-content: center; align-items: flex-start; }
      </style>
    </head><body></body></html>`);
    printWindow.document.close();
    printWindow.document.body.appendChild(clone);

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  static async export(
    element: HTMLElement,
    format: ExportFormat,
    options: ExportOptions,
    baseName = "emploi-du-temps-flora",
  ): Promise<void> {
    const suffix = `${options.pageFormat ?? "a4"}-${options.orientation === "portrait" ? "portrait" : "paysage"}`;

    switch (format) {
      case "pdf":
        return this.exportPdf(element, options, `${baseName}-${suffix}.pdf`);
      case "png":
        return this.exportPng(element, options, `${baseName}-${suffix}.png`);
      case "jpeg":
        return this.exportJpeg(element, options, `${baseName}-${suffix}.jpg`);
      case "print":
        return this.printLayout(element, options);
      default:
        throw new Error("Format d'export inconnu.");
    }
  }
}
