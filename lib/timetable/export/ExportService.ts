import { toJpeg, toPng } from "html-to-image";
import type { ExportFormat, PrintOrientation } from "./types";
import { getPageDimensions } from "./PdfGenerator";
import { PdfGenerator } from "./PdfGenerator";

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

/**
 * Orchestrates export from the dedicated print layout DOM node.
 * This service never captures the interactive TimetableGrid.
 */
export class ExportService {
  static async renderLayoutToPng(
    element: HTMLElement,
    orientation: PrintOrientation,
  ): Promise<string> {
    await waitForFonts();
    const { width, height } = getPageDimensions(orientation);

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
    orientation: PrintOrientation,
    filename: string,
  ): Promise<void> {
    const dataUrl = await this.renderLayoutToPng(element, orientation);
    await PdfGenerator.fromImageDataUrl(dataUrl, orientation, filename);
  }

  static async exportPng(
    element: HTMLElement,
    orientation: PrintOrientation,
    filename: string,
  ): Promise<void> {
    await waitForFonts();
    const { width, height } = getPageDimensions(orientation);
    const dataUrl = await toPng(element, { ...CAPTURE_OPTIONS, width, height });
    downloadBlob(dataUrlToBlob(dataUrl), filename);
  }

  static async exportJpeg(
    element: HTMLElement,
    orientation: PrintOrientation,
    filename: string,
  ): Promise<void> {
    await waitForFonts();
    const { width, height } = getPageDimensions(orientation);
    const dataUrl = await toJpeg(element, {
      ...CAPTURE_OPTIONS,
      width,
      height,
      quality: 0.95,
    });
    downloadBlob(dataUrlToBlob(dataUrl), filename);
  }

  static printLayout(element: HTMLElement, orientation: PrintOrientation = "portrait"): void {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");
    if (!printWindow) {
      throw new Error("Impossible d'ouvrir la fenêtre d'impression.");
    }

    const pageSize = orientation === "landscape" ? "A4 landscape" : "A4 portrait";
    const clone = element.cloneNode(true) as HTMLElement;

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Emploi du temps — Flora</title>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>
        @page { size: ${pageSize}; margin: 8mm; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: white;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
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
    orientation: PrintOrientation,
    baseName = "emploi-du-temps-flora",
  ): Promise<void> {
    switch (format) {
      case "pdf":
        return this.exportPdf(
          element,
          orientation,
          `${baseName}-${orientation === "portrait" ? "portrait" : "paysage"}.pdf`,
        );
      case "png":
        return this.exportPng(element, orientation, `${baseName}.png`);
      case "jpeg":
        return this.exportJpeg(element, orientation, `${baseName}.jpg`);
      case "print":
        return this.printLayout(element, orientation);
      default:
        throw new Error("Format d'export inconnu.");
    }
  }
}
