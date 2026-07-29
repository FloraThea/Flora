import fs from "node:fs";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";

async function main() {
  const file = process.argv[2]!;
  const t = (await extractPdfBuffer(fs.readFileSync(file))).text;
  const lines = t.split(/\r?\n/);
  console.log("lines", lines.length);
  lines.slice(0, 25).forEach((line, index) => {
    console.log(`${index + 1}: ${JSON.stringify(line.slice(0, 120))}`);
  });
}

main();
