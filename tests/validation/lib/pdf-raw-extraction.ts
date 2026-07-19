export type PdfPageRecord = {
  page: number;
  textLength: number;
  displayValue: string;
  rawValue: string;
  detectedDates: string[];
  detectedSeances: string[];
  detectedSequences: string[];
  detectedObjectifs: string[];
};

export type PdfRawExtraction = {
  fileName: string;
  generatedAt: string;
  pageCount: number;
  totalTextLength: number;
  pages: PdfPageRecord[];
};

function detectPatterns(text: string) {
  const dates = [...new Set((text.match(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g) ?? []))].slice(0, 10);
  const seances = [...new Set((text.match(/s[ée]ance\s*(?:n[°o]?\s*)?\d+[^\n]*/gi) ?? []))].slice(0, 10);
  const sequences = [...new Set((text.match(/s[ée]quence\s*(?:n[°o]?\s*)?\d+[^\n]*/gi) ?? []))].slice(0, 10);
  const objectifs = [...new Set((text.match(/objectif[s]?\s*[:\-][^\n]*/gi) ?? []))].slice(0, 10);
  return { dates, seances, sequences, objectifs };
}

export async function buildPdfRawExtraction(buffer: Buffer, fileName: string): Promise<PdfRawExtraction> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const textResult = await parser.getText({ parseHyperlinks: false, lineEnforce: true });
    const pages = (textResult.pages ?? []).map((page) => {
      const displayValue = String(page.text ?? "").replace(/\u0000/g, "").trim();
      const signals = detectPatterns(displayValue);
      return {
        page: page.num ?? 0,
        textLength: displayValue.length,
        displayValue,
        rawValue: displayValue,
        detectedDates: signals.dates,
        detectedSeances: signals.seances,
        detectedSequences: signals.sequences,
        detectedObjectifs: signals.objectifs,
      };
    });

    return {
      fileName,
      generatedAt: new Date().toISOString(),
      pageCount: textResult.total ?? pages.length,
      totalTextLength: String(textResult.text ?? "").replace(/\u0000/g, "").trim().length,
      pages,
    };
  } finally {
    await parser.destroy();
  }
}
