"use client";

import { forwardRef, useMemo } from "react";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolvePrintDays } from "@/lib/timetable/export/print-layout-engine";
import { getPrintThemeTokens, PRINT_FONT_URL, TIME_FONT_PX } from "@/lib/timetable/export/print-theme";
import {
  A4_LANDSCAPE_PX,
  A4_PORTRAIT_PX,
  type PrintCustomization,
  type SchedulePrintMeta,
} from "@/lib/timetable/export/types";
import {
  buildScheduleGridModel,
  PX_PER_MINUTE,
  SLOT_GAP_PX,
} from "@/lib/timetable/schedule-grid-layout";
import { PrintHeader } from "./PrintHeader";
import { ScheduleCard } from "./ScheduleCard";

const PAGE_MARGIN_X = 70;
const PAGE_MARGIN_TOP = 56;
const PAGE_MARGIN_BOTTOM = 48;
const HEADER_BLOCK_HEIGHT = 320;
const TIME_COLUMN_WIDTH = 88;

type SchedulePrintLayoutProps = {
  slots: SmartTimetableSlot[];
  schoolDays: string[];
  meta: SchedulePrintMeta;
  customization: PrintCustomization;
};

function WatermarkLayer({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;

  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
      <g fill="#9caf88" opacity="0.35">
        <ellipse cx="40" cy="50" rx="18" ry="28" transform="rotate(-25 40 50)"/>
        <ellipse cx="90" cy="40" rx="16" ry="24" transform="rotate(15 90 40)"/>
        <ellipse cx="140" cy="55" rx="18" ry="26" transform="rotate(-10 140 55)"/>
      </g>
    </svg>
  `);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        backgroundImage: `url("data:image/svg+xml,${svg}")`,
        backgroundSize: "220px 220px",
        pointerEvents: "none",
      }}
    />
  );
}

export const SchedulePrintLayout = forwardRef<HTMLDivElement, SchedulePrintLayoutProps>(
  function SchedulePrintLayout({ slots, schoolDays, meta, customization }, ref) {
    const theme = getPrintThemeTokens(customization.styleTheme);
    const dimensions =
      customization.orientation === "portrait" ? A4_PORTRAIT_PX : A4_LANDSCAPE_PX;
    const days = useMemo(() => resolvePrintDays(schoolDays), [schoolDays]);

    const grid = useMemo(
      () => buildScheduleGridModel(slots, days, undefined, PX_PER_MINUTE * 1.1),
      [slots, days],
    );

    const contentWidth = dimensions.width - PAGE_MARGIN_X * 2;
    const tableHeight =
      dimensions.height - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM - HEADER_BLOCK_HEIGHT;
    const scaleFactor = tableHeight / Math.max(grid.scale.totalHeightPx, 1);
    const scaledHeight = Math.round(grid.scale.totalHeightPx * scaleFactor);
    const timeColWidth = customization.showTimes ? TIME_COLUMN_WIDTH : 0;
    const dayColumnWidth = Math.floor((contentWidth - timeColWidth - 8 * days.length) / days.length);

    const slotsByDay = useMemo(() => {
      const map = new Map<string, typeof grid.positioned>();
      for (const day of days) map.set(day, []);
      for (const positioned of grid.positioned) {
        map.get(positioned.day)?.push(positioned);
      }
      return map;
    }, [grid.positioned, days]);

    return (
      <div
        ref={ref}
        className="flora-print-document"
        style={{
          position: "relative",
          width: dimensions.width,
          height: dimensions.height,
          boxSizing: "border-box",
          padding: `${PAGE_MARGIN_TOP}px ${PAGE_MARGIN_X}px ${PAGE_MARGIN_BOTTOM}px`,
          background: theme.pageBackground,
          color: theme.headerText,
          fontFamily: theme.fontFamily,
          overflow: "hidden",
        }}
      >
        <link href={PRINT_FONT_URL} rel="stylesheet" />
        <WatermarkLayer opacity={theme.watermarkOpacity} />
        <PrintHeader meta={meta} theme={theme} />

        <div style={{ position: "relative", zIndex: 1, height: tableHeight }}>
          {/* En-têtes jours */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: customization.showTimes
                ? `${timeColWidth}px repeat(${days.length}, ${dayColumnWidth}px)`
                : `repeat(${days.length}, ${dayColumnWidth}px)`,
              gap: 8,
              marginBottom: 8,
            }}
          >
            {customization.showTimes ? <div /> : null}
            {days.map((day) => (
              <div
                key={day}
                style={{
                  padding: "10px 8px",
                  borderRadius: 14,
                  background: theme.tableHeaderBg,
                  color: theme.tableHeaderText,
                  fontSize: TIME_FONT_PX + 1,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: customization.showTimes
                ? `${timeColWidth}px repeat(${days.length}, ${dayColumnWidth}px)`
                : `repeat(${days.length}, ${dayColumnWidth}px)`,
              gap: 8,
              height: scaledHeight,
            }}
          >
            {customization.showTimes ? (
              <div
                style={{
                  position: "relative",
                  height: scaledHeight,
                  borderRadius: 14,
                  background: theme.timeColumnBg,
                  border: `1px solid ${theme.borderColor}`,
                }}
              >
                {grid.timeLabels.map((tick) => (
                  <div
                    key={tick.minutes}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: Math.round(tick.topPx * scaleFactor),
                      borderTop: `1px solid ${theme.borderColor}`,
                      paddingTop: 2,
                    }}
                  >
                    {tick.kind === "major" ? (
                      <div
                        style={{
                          fontSize: TIME_FONT_PX,
                          fontWeight: 700,
                          textAlign: "center",
                          transform: "translateY(-50%)",
                        }}
                      >
                        {tick.label}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {days.map((day) => (
              <div
                key={`col-${day}`}
                style={{
                  position: "relative",
                  height: scaledHeight,
                  borderRadius: 14,
                  background: theme.cardBackground,
                  border: `1px solid ${theme.borderColor}`,
                  overflow: "hidden",
                }}
              >
                {grid.timeLabels
                  .filter((t) => t.kind === "major")
                  .map((tick) => (
                    <div
                      key={`${day}-line-${tick.minutes}`}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: Math.round(tick.topPx * scaleFactor),
                        borderTop: `1px dashed ${theme.borderColor}`,
                        opacity: 0.5,
                      }}
                    />
                  ))}

                {(slotsByDay.get(day) ?? []).map(({ slot, topPx, heightPx }) => {
                  const top = Math.round(topPx * scaleFactor);
                  const height = Math.max(
                    4,
                    Math.round(heightPx * scaleFactor) - SLOT_GAP_PX,
                  );
                  return (
                    <div
                      key={slot.id}
                      style={{
                        position: "absolute",
                        left: 4,
                        right: 4,
                        top,
                        height,
                      }}
                    >
                      <ScheduleCard
                        slot={slot}
                        theme={theme}
                        customization={customization}
                        cellWidth={dayColumnWidth - 8}
                        cellHeight={height}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
);
