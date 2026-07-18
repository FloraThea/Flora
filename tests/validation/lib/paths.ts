import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function validationRoot(): string {
  return VALIDATION_ROOT;
}

export function resolveValidationPath(relativePath: string): string {
  return path.join(VALIDATION_ROOT, relativePath);
}

export function readManifest(): ValidationManifest {
  const raw = fs.readFileSync(resolveValidationPath("manifest.json"), "utf8");
  return JSON.parse(raw) as ValidationManifest;
}

export type ValidationDocument = {
  id: string;
  category: "programmation" | "progression" | "emploi_du_temps" | "guides_maitre" | "documents_divers";
  file: string;
  expected: string;
  label: string;
  schoolYear?: string;
};

export type ValidationManifest = {
  version: number;
  description: string;
  documents: ValidationDocument[];
};
