import type { SmartTimetableSlot } from "@/lib/timetable/types";
import {
  buildCardContentLines,
  computeAdaptiveCardTypography,
  getCardPadding,
  getSubjectIcon,
  type PrintThemeTokens,
} from "@/lib/timetable/export/print-theme";
import {
  extractSlotDetails,
  resolvePrintCardBackground,
} from "@/lib/timetable/export/print-layout-engine";
import type { PrintCustomization } from "@/lib/timetable/export/types";
import { useFloraTheme } from "@/components/theme/ThemeProvider";

type ScheduleCardProps = {
  slot: SmartTimetableSlot;
  theme: PrintThemeTokens;
  customization: PrintCustomization;
  variant?: "lesson" | "break";
  cellWidth?: number;
  cellHeight?: number;
};

export function ScheduleCard({
  slot,
  theme,
  customization,
  variant = "lesson",
  cellWidth = 420,
  cellHeight = 200,
}: ScheduleCardProps) {
  const { themeId } = useFloraTheme();
  const monochrome = customization.styleTheme === "monochrome";
  const { objectif, competence, complementaryText, displayTitle } = extractSlotDetails(slot);
  const card = resolvePrintCardBackground(slot, theme.useGradients, monochrome, themeId);
  const metaIcon =
    typeof slot.metadata?.icon === "string" ? slot.metadata.icon : undefined;
  const icon = metaIcon ?? getSubjectIcon(slot.subject, slot.subSubject, slot.slotType);
  const padding = getCardPadding(customization.cardScale);
  const hasIcon = customization.showIcons;

  const contentLines = buildCardContentLines({
    subject: displayTitle,
    subSubject: slot.subSubject,
    complementaryText,
    objectif,
    competence,
    showComplementaryText: customization.showComplementaryText,
    showObjectives: customization.showObjectives,
    showCompetencies: customization.showCompetencies,
  });

  const { fontSizes, lineHeight } = computeAdaptiveCardTypography({
    lines: contentLines,
    cellWidth,
    cellHeight,
    padding,
    hasIcon,
    fontScale: customization.fontScale,
  });

  const cardStyle = {
    width: "100%",
    height: "100%",
    minHeight: cellHeight,
    boxSizing: "border-box" as const,
    padding,
    borderRadius: 20,
    border: `1.5px solid ${card.borderColor}`,
    background: card.background,
    color: card.color,
    boxShadow: theme.shadow,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    overflow: "hidden",
    fontFamily: theme.fontFamily,
  };

  if (variant === "break") {
    const breakFont = Math.max(18, fontSizes[0] ?? 22);
    return (
      <div style={cardStyle}>
        {hasIcon ? (
          <span style={{ fontSize: breakFont * 0.85, lineHeight: 1, marginBottom: 8, opacity: 0.9 }}>
            {icon}
          </span>
        ) : null}
        <div
          style={{
            fontSize: breakFont,
            fontWeight: 700,
            lineHeight,
            wordBreak: "break-word",
            hyphens: "auto",
            width: "100%",
          }}
        >
          {slot.subject}
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {hasIcon ? (
        <span
          style={{
            fontSize: Math.max(16, (fontSizes[0] ?? 22) * 0.65),
            lineHeight: 1,
            marginBottom: 8,
            opacity: 0.85,
          }}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}

      {contentLines.map((line, index) => (
        <div
          key={`${line.role}-${index}`}
          style={{
            marginTop: index > 0 ? 6 : 0,
            fontSize: fontSizes[index] ?? MIN_FALLBACK,
            fontWeight: line.role === "primary" ? 700 : line.role === "secondary" ? 600 : 500,
            lineHeight,
            wordBreak: "break-word",
            hyphens: "auto",
            width: "100%",
            opacity: line.role === "tertiary" ? 0.88 : 1,
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
}

const MIN_FALLBACK = 16;
