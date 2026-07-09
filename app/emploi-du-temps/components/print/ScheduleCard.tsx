import type { SmartTimetableSlot } from "@/lib/timetable/types";
import {
  computeCardFontSizes,
  getCardMinHeight,
  getCardPadding,
  getSubjectIcon,
  type PrintThemeTokens,
} from "@/lib/timetable/export/print-theme";
import {
  extractSlotDetails,
  resolvePrintCardBackground,
} from "@/lib/timetable/export/print-layout-engine";
import type { PrintCustomization } from "@/lib/timetable/export/types";

type ScheduleCardProps = {
  slot: SmartTimetableSlot;
  theme: PrintThemeTokens;
  customization: PrintCustomization;
  variant?: "lesson" | "break";
};

const clampStyle = {
  overflow: "hidden" as const,
  textOverflow: "ellipsis" as const,
  display: "-webkit-box" as const,
  WebkitBoxOrient: "vertical" as const,
};

export function ScheduleCard({
  slot,
  theme,
  customization,
  variant = "lesson",
}: ScheduleCardProps) {
  const monochrome = customization.styleTheme === "monochrome";
  const { objectif, competence, complementaryText } = extractSlotDetails(slot);

  const visibleParts = [
    slot.subject,
    slot.subSubject,
    customization.showObjectives ? objectif : "",
    customization.showCompetencies ? competence : "",
    customization.showComplementaryText ? complementaryText : "",
  ].filter(Boolean);

  const contentLength = visibleParts.join(" ").length;
  const fonts = computeCardFontSizes(contentLength, customization.fontScale);
  const card = resolvePrintCardBackground(slot, theme.useGradients, monochrome);
  const icon = getSubjectIcon(slot.subject, slot.subSubject, slot.slotType);
  const padding = getCardPadding(customization.cardScale);
  const minHeight = getCardMinHeight(customization.cardScale);

  if (variant === "break") {
    return (
      <div
        style={{
          borderRadius: 16,
          border: `1px solid ${card.borderColor}`,
          background: card.background,
          color: card.color,
          boxShadow: theme.shadow,
          padding: `${padding + 4}px ${padding + 8}px`,
          textAlign: "center",
          fontWeight: 600,
          fontSize: fonts.subject,
        }}
      >
        <span style={{ marginRight: 8, fontSize: 18 }}>{icon}</span>
        {slot.subject}
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        minHeight,
        boxSizing: "border-box",
        padding,
        borderRadius: 16,
        border: `1px solid ${card.borderColor}`,
        background: card.background,
        color: card.color,
        boxShadow: theme.shadow,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      {customization.showIcons ? (
        <span style={{ fontSize: 18, lineHeight: 1, opacity: 0.8, marginBottom: 6 }}>{icon}</span>
      ) : null}

      <div
        style={{
          ...clampStyle,
          fontSize: fonts.subject,
          fontWeight: 700,
          lineHeight: 1.15,
          WebkitLineClamp: 2,
          width: "100%",
        }}
      >
        {slot.subject}
      </div>

      {slot.subSubject ? (
        <div
          style={{
            marginTop: 4,
            fontSize: fonts.subSubject,
            fontWeight: 500,
            lineHeight: 1.2,
            opacity: 0.92,
            ...clampStyle,
            WebkitLineClamp: 2,
            width: "100%",
          }}
        >
          {slot.subSubject}
        </div>
      ) : null}

      {customization.showComplementaryText && complementaryText ? (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: fonts.detail,
            lineHeight: 1.25,
            opacity: 0.88,
            ...clampStyle,
            WebkitLineClamp: 2,
            width: "100%",
          }}
        >
          {complementaryText}
        </p>
      ) : null}

      {customization.showObjectives && objectif ? (
        <p
          style={{
            margin: "5px 0 0",
            fontSize: fonts.detail,
            lineHeight: 1.25,
            opacity: 0.85,
            ...clampStyle,
            WebkitLineClamp: 2,
            width: "100%",
          }}
        >
          {objectif}
        </p>
      ) : null}

      {customization.showCompetencies && competence ? (
        <p
          style={{
            margin: "4px 0 0",
            fontSize: fonts.detail - 0.5,
            lineHeight: 1.2,
            opacity: 0.75,
            ...clampStyle,
            WebkitLineClamp: 2,
            width: "100%",
          }}
        >
          {competence}
        </p>
      ) : null}
    </div>
  );
}
