import type { FontScale, PrintCustomization, PrintStyleTheme } from "./types";

export function getSubjectIcon(subject: string, subSubject = "", slotType?: string): string {
  const key = `${subject} ${subSubject}`.toLowerCase();

  if (slotType === "recreation") return "☀️";
  if (slotType === "pause_meridienne") return "🍴";

  if (key.includes("math")) return "➕";
  if (key.includes("français") || key.includes("francais") || key.includes("lecture")) return "📖";
  if (key.includes("art")) return "🎨";
  if (key.includes("eps") || key.includes("sport")) return "🏃";
  if (key.includes("musique")) return "🎵";
  if (key.includes("anglais") || key.includes("langue")) return "🇬🇧";
  if (key.includes("questionner")) return "🌍";
  if (key.includes("science")) return "🔬";
  if (key.includes("histoire")) return "🏛️";
  if (key.includes("géographie") || key.includes("geographie")) return "🗺️";
  if (key.includes("emc") || key.includes("civique")) return "🤝";
  if (key.includes("rituel")) return "✨";
  if (key.includes("apc")) return "🌱";

  return "📘";
}

export type PrintThemeTokens = {
  pageBackground: string;
  cardBackground: string;
  borderColor: string;
  headerText: string;
  mutedText: string;
  tableHeaderBg: string;
  tableHeaderText: string;
  timeColumnBg: string;
  shadow: string;
  watermarkOpacity: number;
  useGradients: boolean;
  fontFamily: string;
};

export function getPrintThemeTokens(theme: PrintStyleTheme): PrintThemeTokens {
  const base: PrintThemeTokens = {
    pageBackground: "#ffffff",
    cardBackground: "#faf8f4",
    borderColor: "rgba(61, 56, 53, 0.08)",
    headerText: "#3d3835",
    mutedText: "#6b6560",
    tableHeaderBg: "#9caf88",
    tableHeaderText: "#ffffff",
    timeColumnBg: "#f5f2ec",
    shadow: "0 2px 10px rgba(61, 56, 53, 0.06)",
    watermarkOpacity: 0.04,
    useGradients: true,
    fontFamily: "'Nunito', 'DM Sans', sans-serif",
  };

  switch (theme) {
    case "classic":
      return {
        ...base,
        cardBackground: "#ffffff",
        tableHeaderBg: "#4a5568",
        borderColor: "rgba(0,0,0,0.12)",
        watermarkOpacity: 0,
        useGradients: false,
      };
    case "pastel":
      return {
        ...base,
        pageBackground: "#fffdfb",
        cardBackground: "#fff9f5",
        tableHeaderBg: "#e8c4c4",
        tableHeaderText: "#6b4545",
        timeColumnBg: "#faf3dc",
        watermarkOpacity: 0.05,
      };
    case "nature":
      return {
        ...base,
        pageBackground: "#fbfdf9",
        cardBackground: "#f3f7ef",
        tableHeaderBg: "#6d8560",
        timeColumnBg: "#e8efe3",
        watermarkOpacity: 0.06,
      };
    case "monochrome":
      return {
        ...base,
        pageBackground: "#ffffff",
        cardBackground: "#f7f7f7",
        tableHeaderBg: "#333333",
        tableHeaderText: "#ffffff",
        timeColumnBg: "#efefef",
        borderColor: "rgba(0,0,0,0.15)",
        watermarkOpacity: 0,
        useGradients: false,
      };
    case "flora":
    default:
      return base;
  }
}

export const PRINT_STYLE_LABELS: Record<PrintStyleTheme, string> = {
  flora: "Flora",
  classic: "Classique",
  pastel: "Pastel",
  nature: "Nature",
  monochrome: "Noir et blanc",
};

const FONT_SCALE_MULTIPLIER: Record<FontScale, number> = {
  small: 0.88,
  normal: 1,
  large: 1.12,
};

const CARD_PADDING: Record<PrintCustomization["cardScale"], number> = {
  compact: 8,
  normal: 12,
  comfortable: 16,
};

const CARD_MIN_HEIGHT: Record<PrintCustomization["cardScale"], number> = {
  compact: 60,
  normal: 72,
  comfortable: 88,
};

export function getCardPadding(cardScale: PrintCustomization["cardScale"]): number {
  return CARD_PADDING[cardScale];
}

export function getCardMinHeight(cardScale: PrintCustomization["cardScale"]): number {
  return CARD_MIN_HEIGHT[cardScale];
}

export function computeCardFontSizes(
  contentLength: number,
  fontScale: FontScale = "normal",
): {
  subject: number;
  subSubject: number;
  detail: number;
} {
  const multiplier = FONT_SCALE_MULTIPLIER[fontScale];
  let base: { subject: number; subSubject: number; detail: number };

  if (contentLength > 90) base = { subject: 11, subSubject: 9, detail: 8 };
  else if (contentLength > 60) base = { subject: 12, subSubject: 10, detail: 8.5 };
  else if (contentLength > 35) base = { subject: 13, subSubject: 11, detail: 9 };
  else base = { subject: 14, subSubject: 11.5, detail: 9.5 };

  return {
    subject: Math.round(base.subject * multiplier * 10) / 10,
    subSubject: Math.round(base.subSubject * multiplier * 10) / 10,
    detail: Math.round(base.detail * multiplier * 10) / 10,
  };
}
