import type { FontScale, PrintCustomization, PrintStyleTheme } from "./types";

/** Police proche de Comic Sans MS — lisible à distance en classe. */
export const PRINT_FONT_FAMILY =
  "'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive";

export const PRINT_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap";

export const MIN_CARD_FONT_PX = 16;
export const PRIMARY_FONT_MAX_PX = 30;
export const PRIMARY_FONT_MIN_PX = 22;
export const SECONDARY_FONT_MAX_PX = 20;
export const SECONDARY_FONT_MIN_PX = 16;
export const TIME_FONT_PX = 15;
export const HEADER_TITLE_FONT_PX = 38;

export function getSubjectIcon(subject: string, subSubject = "", slotType?: string): string {
  const key = `${subject} ${subSubject}`.toLowerCase();

  if (slotType === "recreation") return "☀️";
  if (slotType === "pause_meridienne") return "🍴";

  if (key.includes("lecture")) return "📖";
  if (key.includes("écrit") || key.includes("ecrit")) return "✍️";
  if (key.includes("grammaire") || key.includes("français") || key.includes("francais")) return "📚";
  if (key.includes("math")) return "➗";
  if (key.includes("art")) return "🎨";
  if (key.includes("eps") || key.includes("sport")) return "🏃";
  if (key.includes("géographie") || key.includes("geographie")) return "🌍";
  if (key.includes("science")) return "🧪";
  if (key.includes("musique")) return "🎵";
  if (key.includes("anglais") || key.includes("langue")) return "💬";
  if (key.includes("emc") || key.includes("civique") || key.includes("moral")) return "🕊";
  if (key.includes("histoire")) return "🏛️";
  if (key.includes("questionner")) return "🌍";
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
    headerText: "#2d4739",
    mutedText: "#5a6b52",
    tableHeaderBg: "#9caf88",
    tableHeaderText: "#ffffff",
    timeColumnBg: "#f4f7f2",
    shadow: "0 3px 14px rgba(45, 71, 57, 0.1)",
    watermarkOpacity: 0.035,
    useGradients: true,
    fontFamily: PRINT_FONT_FAMILY,
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
        watermarkOpacity: 0.04,
      };
    case "nature":
      return {
        ...base,
        pageBackground: "#fbfdf9",
        cardBackground: "#f3f7ef",
        tableHeaderBg: "#6d8560",
        timeColumnBg: "#e8efe3",
        watermarkOpacity: 0.05,
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
  small: 0.92,
  normal: 1,
  large: 1.08,
};

const CARD_PADDING: Record<PrintCustomization["cardScale"], number> = {
  compact: 16,
  normal: 22,
  comfortable: 28,
};

export function getCardPadding(cardScale: PrintCustomization["cardScale"]): number {
  return CARD_PADDING[cardScale];
}

export type CardContentLine = {
  text: string;
  role: "primary" | "secondary" | "tertiary";
};

/** Priorité : texte libre > sous-matière > matière. */
export function buildCardContentLines(input: {
  subject: string;
  subSubject?: string;
  complementaryText?: string;
  objectif?: string;
  competence?: string;
  showComplementaryText: boolean;
  showObjectives: boolean;
  showCompetencies: boolean;
}): CardContentLine[] {
  const lines: CardContentLine[] = [];
  const freeText = input.showComplementaryText ? input.complementaryText?.trim() : "";
  const sub = input.subSubject?.trim() ?? "";
  const subject = input.subject?.trim() ?? "";

  if (freeText) {
    lines.push({ text: freeText, role: "primary" });
    if (sub) lines.push({ text: sub, role: "secondary" });
    if (subject) lines.push({ text: subject, role: "tertiary" });
  } else if (sub) {
    lines.push({ text: sub, role: "primary" });
    if (subject) lines.push({ text: subject, role: "secondary" });
  } else if (subject) {
    lines.push({ text: subject, role: "primary" });
  }

  if (input.showObjectives && input.objectif?.trim()) {
    lines.push({ text: input.objectif.trim(), role: "tertiary" });
  }
  if (input.showCompetencies && input.competence?.trim()) {
    lines.push({ text: input.competence.trim(), role: "tertiary" });
  }

  return lines;
}

function estimateWrappedLines(text: string, fontSize: number, maxWidth: number): number {
  if (maxWidth <= 0 || fontSize <= 0) return 1;
  const charsPerLine = Math.max(4, Math.floor(maxWidth / (fontSize * 0.52)));
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let current = 0;
  for (const word of words) {
    const next = current === 0 ? word.length : current + 1 + word.length;
    if (next > charsPerLine) {
      lines += 1;
      current = word.length;
    } else {
      current = next;
    }
  }
  return lines;
}

function fitFontSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  minSize: number,
  maxSize: number,
): number {
  for (let size = maxSize; size >= minSize; size -= 1) {
    const lines = estimateWrappedLines(text, size, maxWidth);
    const lineHeight = size * 1.22;
    const totalHeight = lines * lineHeight;
    if (totalHeight <= maxHeight) return size;
  }
  return minSize;
}

export function computeAdaptiveCardTypography(input: {
  lines: CardContentLine[];
  cellWidth: number;
  cellHeight: number;
  padding: number;
  hasIcon: boolean;
  fontScale?: FontScale;
}): { fontSizes: number[]; lineHeight: number } {
  const scale = FONT_SCALE_MULTIPLIER[input.fontScale ?? "normal"];
  const innerWidth = Math.max(40, input.cellWidth - input.padding * 2);
  const iconSpace = input.hasIcon ? 32 : 0;
  const innerHeight = Math.max(40, input.cellHeight - input.padding * 2 - iconSpace);
  const gap = 6;
  const lineCount = Math.max(input.lines.length, 1);

  const roleMax: Record<CardContentLine["role"], number> = {
    primary: PRIMARY_FONT_MAX_PX * scale,
    secondary: SECONDARY_FONT_MAX_PX * scale,
    tertiary: SECONDARY_FONT_MAX_PX * scale,
  };
  const roleMin: Record<CardContentLine["role"], number> = {
    primary: PRIMARY_FONT_MIN_PX * scale,
    secondary: SECONDARY_FONT_MIN_PX,
    tertiary: SECONDARY_FONT_MIN_PX,
  };

  const maxSizes = input.lines.map((line) => roleMax[line.role]);
  const minSizes = input.lines.map((line) => Math.max(MIN_CARD_FONT_PX, roleMin[line.role]));

  let sizes = input.lines.map((line, index) =>
    fitFontSize(line.text, innerWidth, innerHeight / lineCount, minSizes[index], maxSizes[index]),
  );

  const totalHeight = () =>
    sizes.reduce((sum, size, index) => {
      const lines = estimateWrappedLines(input.lines[index].text, size, innerWidth);
      return sum + lines * size * 1.22 + (index > 0 ? gap : 0);
    }, 0);

  while (totalHeight() > innerHeight && sizes.some((s) => s > MIN_CARD_FONT_PX)) {
    sizes = sizes.map((s) => Math.max(MIN_CARD_FONT_PX, s - 1));
  }

  return { fontSizes: sizes, lineHeight: 1.22 };
}

/** Choisit noir ou blanc selon la luminance du fond (pastel imprimable). */
export function getContrastTextColor(background: string): "#1a1a1a" | "#ffffff" {
  const hex = extractHexFromBackground(background);
  if (!hex) return "#1a1a1a";

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#1a1a1a" : "#ffffff";
}

function extractHexFromBackground(background: string): string | null {
  const gradientMatch = background.match(/#([0-9a-fA-F]{6})/);
  if (gradientMatch) return `#${gradientMatch[1]}`;
  if (background.startsWith("#") && background.length >= 7) return background.slice(0, 7);
  return null;
}

/** @deprecated Utiliser computeAdaptiveCardTypography */
export function computeCardFontSizes(contentLength: number, fontScale: FontScale = "normal") {
  const multiplier = FONT_SCALE_MULTIPLIER[fontScale];
  let base: { subject: number; subSubject: number; detail: number };

  if (contentLength > 90) base = { subject: 20, subSubject: 18, detail: 16 };
  else if (contentLength > 60) base = { subject: 24, subSubject: 18, detail: 16 };
  else if (contentLength > 35) base = { subject: 26, subSubject: 18, detail: 16 };
  else base = { subject: 30, subSubject: 20, detail: 16 };

  return {
    subject: Math.round(base.subject * multiplier * 10) / 10,
    subSubject: Math.round(base.subSubject * multiplier * 10) / 10,
    detail: Math.round(base.detail * multiplier * 10) / 10,
  };
}
