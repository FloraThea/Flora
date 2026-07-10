import type { LibraryCategory } from "./types";

const DOCUMENT_TYPE_TO_CATEGORY: Record<string, LibraryCategory> = {
  BO: "Référentiel BO",
  "guide du maître": "Guide enseignant",
  manuel: "Guide enseignant",
  album: "Ressource pédagogique",
  séquence: "Séquence",
  seance: "Séquence",
  séance: "Séquence",
  "cahier journal": "Cahier journal",
  programmation: "Programmation",
  progression: "Progression",
  "ressource personnelle": "Personnel",
  "ressource pédagogique": "Ressource pédagogique",
  évaluation: "Ressource pédagogique",
  methode: "Méthode",
  méthode: "Méthode",
};

export function mapDocumentTypeToCategory(documentType: string): LibraryCategory {
  const normalized = documentType.trim().toLowerCase();
  for (const [key, category] of Object.entries(DOCUMENT_TYPE_TO_CATEGORY)) {
    if (key.toLowerCase() === normalized) return category;
  }
  if (normalized.includes("bo") || normalized.includes("bulletin")) return "Référentiel BO";
  if (normalized.includes("guide")) return "Guide enseignant";
  if (normalized.includes("programm")) return "Programmation";
  if (normalized.includes("progress")) return "Progression";
  if (normalized.includes("séquence") || normalized.includes("sequence")) return "Séquence";
  if (normalized.includes("journal")) return "Cahier journal";
  if (normalized.includes("mhm") || normalized.includes("narramus")) return "Méthode";
  return "Ressource pédagogique";
}

export function isLikelyBoDocument(fileName: string, mimeType?: string): boolean {
  const lower = fileName.toLowerCase();
  const extension = lower.slice(lower.lastIndexOf("."));

  if (![".pdf", ".docx", ".doc", ".txt"].includes(extension)) {
    return false;
  }

  const boKeywords = [
    "bo",
    "bulletin",
    "officiel",
    "referentiel",
    "référentiel",
    "programme",
    "socle",
    "enseignements",
  ];

  if (boKeywords.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  return mimeType === "application/pdf" && lower.includes("francais");
}
