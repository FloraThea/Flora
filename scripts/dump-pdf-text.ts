import fs from "node:fs";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";

async function main() {
  const file = process.argv[2]!;
  const t = (await extractPdfBuffer(fs.readFileSync(file))).text;
  console.log(t.slice(0, Number(process.argv[3] ?? 4000)));
}

main();
