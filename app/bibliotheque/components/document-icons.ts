import type { FloraDocument } from "@/lib/documents/types";

const TYPE_ICONS: Record<string, string> = {
  BO: "📘",
  "guide du maître": "📗",
  manuel: "📙",
  album: "🖼️",
  séquence: "🧩",
  séance: "📝",
  "cahier journal": "📓",
  programmation: "🗂️",
  progression: "📈",
  "ressource personnelle": "✨",
};

const EXTENSION_ICONS: Record<string, string> = {
  pdf: "📄",
  docx: "📃",
  pptx: "📊",
  xlsx: "📑",
  txt: "📋",
};

export function getDocumentIcon(document: FloraDocument): string {
  const typeKey = document.document_type?.toLowerCase().trim();

  if (typeKey && TYPE_ICONS[typeKey]) {
    return TYPE_ICONS[typeKey];
  }

  for (const [label, icon] of Object.entries(TYPE_ICONS)) {
    if (typeKey?.includes(label)) return icon;
  }

  return EXTENSION_ICONS[document.file_extension] ?? "📚";
}
