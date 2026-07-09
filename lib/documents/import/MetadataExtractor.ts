import type { DocumentMetadataDraft } from "./types";

const METHOD_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /mhm|mains libres/i, label: "MHM" },
  { pattern: /narramus/i, label: "Narramus" },
  { pattern: /acc[eè]s/i, label: "Accès" },
  { pattern: /retz/i, label: "Retz" },
  { pattern: /cap maths/i, label: "Cap Maths" },
];

export class MetadataExtractor {
  extract(input: {
    filename: string;
    text: string;
    pageCount: number | null;
    fileSize: number;
  }): DocumentMetadataDraft {
    const preview = input.text.slice(0, 4000);
    const title = input.filename.replace(/\.[^.]+$/, "");

    return {
      title,
      auteur: this.matchLine(preview, /(?:auteur|author)\s*[:\-]\s*(.+)/i),
      editeur: this.matchLine(preview, /(?:[ée]diteur|editor|maison)\s*[:\-]\s*(.+)/i),
      niveau: this.matchLine(preview, /(?:niveau|classe)\s*[:\-]\s*(CP|CE1|CE2|CM1|CM2)/i),
      cycle: this.matchLine(preview, /(?:cycle)\s*[:\-]\s*([123])/i),
      discipline: this.matchLine(preview, /(?:discipline|mati[eè]re)\s*[:\-]\s*(.+)/i),
      methode: this.detectMethod(input.filename, preview),
      annee: this.matchLine(preview, /(?:ann[eé]e|edition)\s*[:\-]\s*(\d{4})/i),
      langue: /fran[çc]ais/i.test(preview) ? "fr" : "fr",
      pageCount: input.pageCount,
      imageCount: (input.text.match(/\[image\]|figure|illustration/gi) ?? []).length,
      tableCount: (input.text.match(/\|.*\|/g) ?? []).length,
      documentType: "",
    };
  }

  private matchLine(text: string, pattern: RegExp): string {
    const match = text.match(pattern);
    return match?.[1]?.trim() ?? "";
  }

  private detectMethod(filename: string, preview: string): string {
    const haystack = `${filename} ${preview}`;
    for (const item of METHOD_PATTERNS) {
      if (item.pattern.test(haystack)) return item.label;
    }
    return "";
  }
}

export const metadataExtractor = new MetadataExtractor();
