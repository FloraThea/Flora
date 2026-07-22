import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Runtime Node Flora : CJS pdf-parse (legacy pdf.js inliné). */
function loadPdfParse() {
  if (typeof globalThis.DOMMatrix === "undefined") {
    try {
      const canvas = require("@napi-rs/canvas");
      if (canvas.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix;
      if (canvas.ImageData) globalThis.ImageData = canvas.ImageData;
      if (canvas.Path2D) globalThis.Path2D = canvas.Path2D;
    } catch {
      // Texte natif OK sans polyfill.
    }
  }
  return require("pdf-parse");
}

async function main() {
  const pdfPath = process.argv[2] ?? join(root, "tests/validation/guides_maitre/MHM_CE1_CE2_GUIDE.pdf");
  const buffer = readFileSync(pdfPath);

  const { PDFParse } = loadPdfParse();
  const parser = new PDFParse({ data: buffer });

  try {
    const info = await parser.getInfo();
    const textResult = await parser.getText();
    const text = (textResult.text ?? "").trim();

    console.log(
      JSON.stringify(
        {
          file: pdfPath,
          pageCount: info.total,
          textLength: text.length,
          extractionMethod: "pdf-text",
          usedOcr: false,
          charsPerPage: info.total > 0 ? Math.round(text.length / info.total) : null,
          preview: text.slice(0, 500),
        },
        null,
        2,
      ),
    );
  } finally {
    await parser.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
