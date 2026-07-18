import type { CSSProperties, ReactNode } from "react";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolveSlotAppearance } from "@/lib/timetable/subject-palette";
import { readSlotMeta } from "@/lib/timetable/slot-editor/operations";
import { defaultIconForSlot } from "@/lib/timetable/slot-editor/constants";
import { resolveSlotCardDisplay } from "@/lib/timetable/slot-display";
import {
  buildClassroomExportCardBlocks,
  type ExportCardBlock,
} from "@/lib/timetable/export/export-card-layout";
import {
  computeSlotCardTypography,
  computeUniformPrintTypography,
  EXPORT_SCHEDULE_FONT_SIZE_PX,
  EXPORT_SCHEDULE_TIME_FONT_SIZE_PX,
} from "@/lib/timetable/slot-card-typography";
import {
  EXPORT_BREAK_CARD_HEIGHT,
  EXPORT_LESSON_CARD_HEIGHT,
  isExportBreakSlotType,
} from "@/lib/timetable/export/export-card-dimensions";
import type { FloraAppThemeId } from "@/lib/themes/types";

export type ScheduleCardMode = "screen" | "export";

export type ScheduleCardViewProps = {
  slot: SmartTimetableSlot;
  mode: ScheduleCardMode;
  themeId?: FloraAppThemeId;
  density?: "grid" | "compact";
  showComplementaryText?: boolean;
  showIcons?: boolean;
  showLevels?: boolean;
  showRoomAndTeacher?: boolean;
  fixedHeightPx?: number;
  className?: string;
  children?: ReactNode;
};

const LINE_GAP_PX = 4;

function exportBlockStyle(
  block: ExportCardBlock,
  typography: ReturnType<typeof computeUniformPrintTypography>,
): CSSProperties {
  const base: CSSProperties = {
    width: "100%",
    lineHeight: 1.15,
    wordBreak: "break-word",
    overflowWrap: "break-word",
    whiteSpace: "normal",
    overflow: "visible",
  };

  switch (block.kind) {
    case "time":
      return { ...base, fontSize: typography.timePx, fontWeight: 700, marginBottom: LINE_GAP_PX };
    case "subjectInline":
    case "subject":
      return { ...base, fontSize: typography.subjectPx, fontWeight: 700, marginTop: LINE_GAP_PX };
    case "complementary":
    case "subSubject":
      return { ...base, fontSize: typography.secondaryPx, fontWeight: 700, marginTop: LINE_GAP_PX };
    default:
      return base;
  }
}

function renderExportBlock(
  block: ExportCardBlock,
  index: number,
  typography: ReturnType<typeof computeUniformPrintTypography>,
) {
  const style = exportBlockStyle(block, typography);

  if (block.kind === "subjectInline") {
    return (
      <div key={`inline-${index}`} style={style}>
        {block.subject}
        <span style={{ fontWeight: 700 }}> — </span>
        {block.complementary}
      </div>
    );
  }

  if (
    block.kind === "time" ||
    block.kind === "subject" ||
    block.kind === "complementary" ||
    block.kind === "subSubject"
  ) {
    return (
      <div key={`${block.kind}-${index}`} style={style}>
        {block.text}
      </div>
    );
  }

  return null;
}

export function ScheduleCardView({
  slot,
  mode,
  themeId = "flora",
  density = "grid",
  showComplementaryText = true,
  showIcons = true,
  showLevels = true,
  showRoomAndTeacher = false,
  fixedHeightPx,
  className = "",
  children,
}: ScheduleCardViewProps) {
  const meta = readSlotMeta(slot);
  const useCustomColor = meta.useCustomColor && slot.color;
  const display = resolveSlotCardDisplay(slot);
  const isBreak = isExportBreakSlotType(slot.slotType);
  const icon = meta.icon ?? defaultIconForSlot(slot.subject, slot.subSubject, slot.slotType);
  const teacher = meta.teacherName || slot.intervenant;

  const appearance = useCustomColor
    ? {
        color: slot.color,
        gradient: slot.gradient || slot.color,
        borderColor: slot.color,
        textColor: "#1a1a1a",
      }
    : resolveSlotAppearance(
        {
          subject: slot.subject,
          subSubject: slot.subSubject,
          slotType: slot.slotType,
          color: slot.color,
          gradient: slot.gradient,
        },
        themeId,
      );

  if (mode === "export") {
    const typography = computeUniformPrintTypography();
    const minCardHeight =
      fixedHeightPx ?? (isBreak ? EXPORT_BREAK_CARD_HEIGHT : EXPORT_LESSON_CARD_HEIGHT);

    const blocks = buildClassroomExportCardBlocks({
      timeLabel: display.timeLabel,
      subject: display.subject,
      subSubject: display.subSubject,
      complementaryText: display.complementaryText,
      showComplementaryText,
    });

    const cardStyle: CSSProperties = {
      width: "100%",
      minHeight: minCardHeight,
      height: "auto",
      boxSizing: "border-box",
      padding: "8px 10px",
      borderRadius: 12,
      border: `1px solid ${appearance.borderColor}`,
      background: appearance.gradient,
      color: appearance.textColor,
      boxShadow: "var(--shadow-card, 0 3px 14px rgba(45, 71, 57, 0.1))",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      textAlign: "left",
      overflow: "visible",
      fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ["--schedule-export-main-font-size" as any]: `${EXPORT_SCHEDULE_FONT_SIZE_PX}px`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ["--schedule-export-time-font-size" as any]: `${EXPORT_SCHEDULE_TIME_FONT_SIZE_PX}px`,
    };

    return (
      <div className={`schedule-export-card ${className}`.trim()} style={cardStyle}>
        <div className="flex w-full shrink-0 items-start justify-between gap-1">
          <span
            style={{
              fontSize: typography.timePx,
              fontWeight: 700,
              borderRadius: 999,
              background: "rgba(255,255,255,0.55)",
              padding: "2px 8px",
            }}
          >
            {display.timeLabel}
          </span>
          {showIcons ? (
            <span style={{ fontSize: typography.timePx * 0.85, lineHeight: 1 }} aria-hidden>
              {icon}
            </span>
          ) : null}
        </div>
        <div className="w-full shrink-0" style={{ overflow: "visible" }}>
          {blocks
            .filter((block) => block.kind !== "time")
            .map((block, index) => renderExportBlock(block, index, typography))}
          {showLevels && display.levels.length > 0 ? (
            <p
              style={{
                fontSize: typography.secondaryPx,
                fontWeight: 700,
                marginTop: LINE_GAP_PX,
                overflow: "visible",
                whiteSpace: "normal",
              }}
            >
              {display.levels.join(" · ")}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    );
  }

  const typography = computeSlotCardTypography(fixedHeightPx ?? 72);
  const isGrid = density === "grid";

  return (
    <article
      className={`group relative flex flex-col overflow-hidden border text-left shadow-[var(--shadow-card)] ${className} ${
        isGrid
          ? "rounded-xl px-2 py-1 md:px-2.5 md:py-1.5"
          : "rounded-[1.25rem] px-3 py-2.5"
      }`.trim()}
      style={{
        background: appearance.gradient,
        borderColor: appearance.borderColor,
        color: appearance.textColor,
        height: fixedHeightPx ? fixedHeightPx : undefined,
      }}
    >
      <div className={`flex shrink-0 items-start justify-between gap-1 ${isGrid ? "mb-0.5" : "mb-1.5"}`}>
        <span
          className={`schedule-card-time rounded-full bg-white/55 px-1.5 py-0.5 tracking-wide ${
            isGrid ? "" : "text-[10px] font-medium"
          }`}
        >
          {display.timeLabel}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {showIcons && typography.showTertiary ? (
            <span className="text-xs leading-none" aria-hidden>
              {icon}
            </span>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <h5
          className={`schedule-card-subject font-serif ${
            isGrid ? "" : "text-sm font-medium leading-snug"
          }`}
          style={isGrid ? { WebkitLineClamp: typography.lineClamp } : undefined}
        >
          {display.subject}
        </h5>
        {display.subSubject && typography.showSecondary ? (
          <p
            className={`schedule-card-secondary mt-0.5 opacity-95 ${
              isGrid ? "" : "text-xs font-light opacity-90"
            }`}
            style={isGrid ? { WebkitLineClamp: typography.lineClamp } : undefined}
          >
            {display.subSubject}
          </p>
        ) : null}
        {display.complementaryText && typography.showComplementaryText ? (
          <p
            className={`schedule-card-secondary mt-0.5 leading-snug opacity-95 ${
              isGrid ? "" : "text-xs font-light"
            }`}
            style={isGrid ? { WebkitLineClamp: typography.complementaryLineClamp } : undefined}
          >
            {display.complementaryText}
          </p>
        ) : null}
        {showLevels && typography.showTertiary && display.levels.length > 0 ? (
          <p className={`schedule-card-secondary mt-0.5 opacity-85 ${isGrid ? "" : "text-[10px] font-light"}`}>
            {display.levels.join(" · ")}
          </p>
        ) : null}
        {showRoomAndTeacher && !isGrid && (slot.room || teacher) ? (
          <div className="schedule-card-secondary mt-1 space-y-0.5 font-light opacity-80">
            {slot.room ? <p className="line-clamp-1">{slot.room}</p> : null}
            {teacher ? <p className="line-clamp-1">{teacher}</p> : null}
          </div>
        ) : null}
        {isGrid && typography.showTertiary && (slot.room || teacher) ? (
          <p className="schedule-card-secondary mt-0.5 line-clamp-1 opacity-85">
            {[slot.room, teacher].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      {children}
    </article>
  );
}
