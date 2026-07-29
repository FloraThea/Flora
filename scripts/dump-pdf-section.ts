import fs from "node:fs";
import { extractPdfBuffer } from "@/lib/documents/extraction/pdf-extractor";

async function main() {
  const file = process.argv[2]!;
  const marker = process.argv[3] ?? "Les nombres entiers";
  const t = (await extractPdfBuffer(fs.readFileSync(file))).text;
  const start = t.indexOf(marker);
  console.log(t.slice(start, start + Number(process.argv[4] ?? 4000)));
}

main();
