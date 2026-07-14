import type { CSSProperties } from "react";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import {
  buildClassroomExportCardBlocks,
  type ExportCardBlock,
} from "@/lib/timetable/export/export-card-layout";
import { getCardPadding, getSubjectIcon, type PrintThemeTokens } from "@/lib/timetable/export/print-theme";
import { extractSlotDetails, resolvePrintCardBackground } from "@/lib/timetable/export/print-layout-engine";
import type { PrintCustomization } from "@/lib/timetable/export/types";
import {
  computeUniformPrintTypography,
  EXPORT_SCHEDULE_FONT_SIZE_PX,
  EXPORT_SCHEDULE_TIME_FONT_SIZE_PX,
} from "@/lib/timetable/slot-card-typography";
import { useFloraTheme } from "@/components/theme/ThemeProvider";

type ScheduleCardProps = {
  slot: SmartTimetableSlot;
  theme: PrintThemeTokens;
  customization: PrintCustomization;
  variant?: "lesson" | "break";
  cellWidth?: number;
  cellHeight?: number;
};

const LINE_GAP_PX = 4;

function blockStyle(
  block: ExportCardBlock,
  typography: ReturnType<typeof computeUniformPrintTypography>,
): CSSProperties {
  const base: CSSProperties = {
    width: "100%",
    lineHeight: 1.12,
    wordBreak: "break-word",
    overflowWrap: "break-word",
    hyphens: "auto",
  };

  switch (block.kind) {
    case "time":
      return {
        ...base,
        fontSize: typography.timePx,
        fontWeight: 700,
        marginBottom: LINE_GAP_PX,
      };
    case "subjectInline":
    case "subject":
      return {
        ...base,
        fontSize: typography.subjectPx,
        fontWeight: 700,
        marginTop: LINE_GAP_PX,
      };
    case "complementary":
      return {
        ...base,
        fontSize: typography.secondaryPx,
        fontWeight: 700,
        marginTop: LINE_GAP_PX,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: block.maxLines,
        overflow: "hidden",
      };
    case "subSubject":
      return {
        ...base,
        fontSize: typography.secondaryPx,
        fontWeight: 700,
        marginTop: LINE_GAP_PX,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
      };
    case "extra":
      return {
        ...base,
        fontSize: typography.secondaryPx,
        fontWeight: 500,
        marginTop: LINE_GAP_PX,
        opacity: 0.9,
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 2,
        overflow: "hidden",
      };
    default:
      return base;
  }
}

function renderBlock(block: ExportCardBlock, index: number, typography: ReturnType<typeof computeUniformPrintTypography>) {
  const style = blockStyle(block, typography);

  if (block.kind === "subjectInline") {
    return (
      <div key={`inline-${index}`} style={style}>
        {block.subject}
        <span style={{ fontWeight: 700 }}> — </span>
        {block.complementary}
      </div>
    );
  }

  if (block.kind === "time" || block.kind === "subject" || block.kind === "complementary" || block.kind === "subSubject" || block.kind === "extra") {
    return (
      <div key={`${block.kind}-${index}`} style={style}>
        {block.text}
      </div>
    );
  }

  return null;
}

export function ScheduleCard({
  slot,
  theme,
  customization,
  variant = "lesson",
  cellHeight = 200,
}: ScheduleCardProps) {
  const { themeId } = useFloraTheme();
  const monochrome = customization.styleTheme === "monochrome";
  const { objectif, competence, complementaryText } = extractSlotDetails(slot);
  const card = resolvePrintCardBackground(slot, theme.useGradients, monochrome, themeId);
  const metaIcon = typeof slot.metadata?.icon === "string" ? slot.metadata.icon : undefined;
  const icon = metaIcon ?? getSubjectIcon(slot.subject, slot.subSubject, slot.slotType);
  const padding = getCardPadding(customization.cardScale);
  const hasIcon = customization.showIcons && variant === "lesson";
  const typography = computeUniformPrintTypography();
  const timeLabel = `${slot.start} – ${slot.end}`;

  const blocks = buildClassroomExportCardBlocks({
    timeLabel,
    subject: slot.subject,
    subSubject: slot.subSubject,
    complementaryText,
    showComplementaryText: customization.showComplementaryText,
    objectif,
    competence,
    showObjectives: customization.showObjectives,
    showCompetencies: customization.showCompetencies,
  });

  const cardStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    minHeight: cellHeight,
    boxSizing: "border-box",
    padding,
    borderRadius: 14,
    border: `1.5px solid ${card.borderColor}`,
    background: card.background,
    color: card.color,
    boxShadow: theme.shadow,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    overflow: "hidden",
    fontFamily: theme.fontFamily,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ["--schedule-export-font-size" as any]: `${EXPORT_SCHEDULE_FONT_SIZE_PX}px`,
    ["--schedule-export-time-font-size" as any]: `${EXPORT_SCHEDULE_TIME_FONT_SIZE_PX}px`,
  };

  if (variant === "break") {
    const breakBlocks = buildClassroomExportCardBlocks({
      timeLabel,
      subject: slot.subject,
      showComplementaryText: false,
    });

    return (
      <div style={cardStyle}>
        {hasIcon ? (
          <span
            style={{
              fontSize: typography.subjectPx * 0.7,
              lineHeight: 1,
              marginBottom: LINE_GAP_PX,
              opacity: 0.9,
            }}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        {breakBlocks.map((block, index) => renderBlock(block, index, typography))}
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {hasIcon ? (
        <span
          style={{
            fontSize: typography.subjectPx * 0.55,
            lineHeight: 1,
            marginBottom: LINE_GAP_PX,
            opacity: 0.85,
          }}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      {blocks.map((block, index) => renderBlock(block, index, typography))}
    </div>
  );
}
