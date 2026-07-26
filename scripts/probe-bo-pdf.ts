import { readFileSync } from "node:fs";
import { extractTextFromFile } from "@/lib/documents/extract-text";

async function probe(label: string, path: string) {
  const buf = readFileSync(path);
  const file = new File([buf], path.split("/").pop() ?? "bo.pdf", { type: "application/pdf" });
  const result = await extractTextFromFile(file);
  console.log(`\n=== ${label} ===`);
  console.log("pages:", result.pageCount, "chars:", result.textLength);
  const markers = [
    "Objectifs d'apprentissage",
    "Connaissances et compétences",
    "Compétence principale",
    "Nombre et calcul",
    "Les nombres entiers",
    "CP",
    "CE1",
    "CE2",
  ];
  for (const marker of markers) {
    const idx = result.text.indexOf(marker);
    if (idx >= 0) console.log(`marker "${marker}" at ${idx}`);
  }
  const tableIdx = result.text.search(
    /Objectifs d'apprentissage|Connaissances et compétences|Compétence principale/i,
  );
  const start = Math.max(0, tableIdx - 300);
  console.log("\n--- SAMPLE ---\n");
  console.log(result.text.slice(start, start + 4000));
}

async function main() {
  await probe(
    "math",
    "/Users/camille/Library/Messages/Attachments/52/02/937B0E70-35A2-4DED-94D9-5EC36D9E4BA4/Annexe 4 – Programme de mathématiques du cycle 2-403821.pdf",
  );
  await probe(
    "francais",
    "/Users/camille/Library/Messages/Attachments/77/07/DD602B8E-A079-4A18-9B6B-78C9938B0643/Annexe 3 – Programme de français du cycle 2-403818.pdf",
  );
}

void main();
