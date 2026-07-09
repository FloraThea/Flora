import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Charge le module compilé via ts après build, ou teste directement pdf-parse en node.
async function main() {
  const pdfPath = process.argv[2] ?? join(root, "test-fixtures/annexe-3-francais-cycle-2.pdf");
  const buffer = readFileSync(pdfPath);

  const { PDFParse } = await import("pdf-parse");
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
