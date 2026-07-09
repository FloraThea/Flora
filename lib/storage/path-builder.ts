import { randomUUID } from "crypto";
import type { DocumentStorageCategory } from "./types";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\- ]+/g, "_").trim() || "document";
}

export function inferDocumentCategory(
  filename: string,
  documentType?: string,
): DocumentStorageCategory {
  const lowerName = filename.toLowerCase();
  const lowerType = (documentType ?? "").toLowerCase();

  if (lowerType.includes("bo") || lowerName.includes("bulletin officiel")) return "bo";
  if (lowerType.includes("programmation") || lowerName.includes("programmation")) {
    return "programmations";
  }
  if (lowerType.includes("progression") || lowerName.includes("progression")) {
    return "progressions";
  }
  if (lowerType.includes("évaluation") || lowerType.includes("evaluation") || lowerName.includes("evaluation")) {
    return "evaluations";
  }
  if (lowerType.includes("album") || lowerName.includes("album")) return "albums";

  const ext = lowerName.slice(lowerName.lastIndexOf("."));
  if (IMAGE_EXTENSIONS.has(ext)) return "images";

  if (
    lowerType.includes("guide") ||
    lowerName.includes("guide") ||
    lowerType.includes("manuel") ||
    lowerName.includes("manuel")
  ) {
    return "guides";
  }

  return "archives";
}

export function buildDocumentStorageKey(input: {
  userId: string;
  filename: string;
  category?: DocumentStorageCategory;
  documentType?: string;
  objectId?: string;
}): string {
  const category =
    input.category ?? inferDocumentCategory(input.filename, input.documentType);
  const objectId = input.objectId ?? randomUUID();
  const safeName = sanitizeFilename(input.filename);

  return `documents/${input.userId}/${category}/${objectId}-${safeName}`;
}

export function buildTempMultipartPartKey(sessionId: string, partNumber: number): string {
  return `uploads/${sessionId}/parts/${String(partNumber).padStart(6, "0")}`;
}
