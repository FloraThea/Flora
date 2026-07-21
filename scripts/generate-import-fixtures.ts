/**
 * Génère les fixtures d'import Flora (DOCX, PNG, PDF scanné).
 * Usage : node node_modules/tsx/dist/cli.mjs scripts/generate-import-fixtures.ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { createCanvas } from "@napi-rs/canvas";
import { jsPDF } from "jspdf";

const OUT_DIR = path.resolve(process.cwd(), "tests/validation/documents_divers");
const REFERENTIEL_DIR = path.resolve(process.cwd(), "tests/validation/referentiel");

const DOCX_TEXT =
  "Flora — fixture DOCX. Programmation annuelle CE1. Séance 1 : découverte des fractions.";

function writeDocxFixture(): string {
  const target = path.join(OUT_DIR, "exemple.docx");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flora-docx-"));
  const relsDir = path.join(tmp, "_rels");
  const wordDir = path.join(tmp, "word", "_rels");
  fs.mkdirSync(relsDir, { recursive: true });
  fs.mkdirSync(wordDir, { recursive: true });

  fs.writeFileSync(
    path.join(tmp, "[Content_Types].xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  fs.writeFileSync(
    path.join(relsDir, ".rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  fs.writeFileSync(
    path.join(wordDir, "document.xml.rels"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );

  fs.writeFileSync(
    path.join(tmp, "word", "document.xml"),
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${DOCX_TEXT}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );

  if (fs.existsSync(target)) fs.unlinkSync(target);
  execSync(`cd "${tmp}" && zip -qr "${target}" .`, { stdio: "inherit" });
  fs.rmSync(tmp, { recursive: true, force: true });
  return target;
}

function writePngFixture(): string {
  const target = path.join(OUT_DIR, "exemple.png");
  const canvas = createCanvas(860, 160);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111111";
  ctx.font = "28px Arial";
  ctx.fillText("Flora import OCR — Programmation CE1", 24, 70);
  ctx.font = "20px Arial";
  ctx.fillText("Seance 3 : les fractions decimales", 24, 110);
  fs.writeFileSync(target, canvas.toBuffer("image/png"));
  return target;
}

function writeScannedPdfFixture(): string {
  const target = path.join(OUT_DIR, "scan_ocr_test.pdf");
  const canvas = createCanvas(860, 180);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8f8f8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "26px Arial";
  ctx.fillText("Document scanne Flora — Cahier journal", 24, 70);
  ctx.font="18px Arial";
  ctx.fillText("Mardi 10h15 : Conjugaison present de l indicatif", 24, 110);

  const pngData = canvas.toBuffer("image/png");
  const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [860, 180] });
  doc.addImage(pngData, "PNG", 0, 0, 860, 180);
  fs.writeFileSync(target, Buffer.from(doc.output("arraybuffer")));
  return target;
}

function copyBoFixture(): string | null {
  const downloads = path.join(process.env.HOME ?? "", "Downloads");
  if (!fs.existsSync(downloads)) return null;

  const match = fs
    .readdirSync(downloads)
    .find((name) => name.endsWith("-405261.pdf") || /405261\.pdf$/i.test(name));
  if (!match) return null;

  fs.mkdirSync(REFERENTIEL_DIR, { recursive: true });
  const target = path.join(REFERENTIEL_DIR, "Programme_EVAR_elementaire-405261.pdf");
  fs.copyFileSync(path.join(downloads, match), target);
  return target;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const docx = writeDocxFixture();
  const png = writePngFixture();
  const scanPdf = writeScannedPdfFixture();
  const bo = copyBoFixture();

  console.log("Fixtures générées :");
  console.log(`- DOCX : ${docx}`);
  console.log(`- PNG  : ${png}`);
  console.log(`- PDF scanné : ${scanPdf}`);
  console.log(bo ? `- BO EVAR : ${bo}` : "- BO EVAR : non copié (PDF absent de ~/Downloads)");
}

main();
