"use client";

import { forwardRef, useMemo } from "react";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import {
  buildPrintScheduleRows,
  resolvePrintDays,
} from "@/lib/timetable/export/print-layout-engine";
import { getPrintThemeTokens, PRINT_FONT_URL, TIME_FONT_PX } from "@/lib/timetable/export/print-theme";
import {
  A4_LANDSCAPE_PX,
  A4_PORTRAIT_PX,
  type PrintCustomization,
  type SchedulePrintMeta,
} from "@/lib/timetable/export/types";
import { PrintHeader } from "./PrintHeader";
import { ScheduleCard } from "./ScheduleCard";

/** Marges d'impression A4 (~10 mm à 300 dpi). */
const PAGE_MARGIN_X = 70;
const PAGE_MARGIN_TOP = 56;
const PAGE_MARGIN_BOTTOM = 48;
const TABLE_GAP = 4;
const TIME_COLUMN_WIDTH = 148;
const HEADER_BLOCK_HEIGHT = 320;

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
        <circle cx="65" cy="120" r="6" fill="#e8c4c4"/>
        <circle cx="115" cy="130" r="5" fill="#e8c4c4"/>
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
    const rows = useMemo(() => buildPrintScheduleRows(slots, days), [slots, days]);

    const contentWidth = dimensions.width - PAGE_MARGIN_X * 2;
    const tableHeight =
      dimensions.height - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM - HEADER_BLOCK_HEIGHT;
    const rowHeight = Math.max(88, Math.floor(tableHeight / Math.max(rows.length, 1)));
    const dayColumnCount = days.length;
    const timeColWidth = customization.showTimes ? TIME_COLUMN_WIDTH : 0;
    const horizontalGaps = TABLE_GAP * (dayColumnCount + (customization.showTimes ? 1 : 0));
    const cellWidth = Math.floor((contentWidth - timeColWidth - horizontalGaps) / dayColumnCount);

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
          <table
            style={{
              width: "100%",
              height: "100%",
              borderCollapse: "separate",
              borderSpacing: TABLE_GAP,
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                {customization.showTimes ? (
                  <th
                    style={{
                      width: TIME_COLUMN_WIDTH,
                      padding: "14px 10px",
                      borderRadius: 16,
                      background: theme.timeColumnBg,
                      color: theme.headerText,
                      fontSize: TIME_FONT_PX,
                      fontWeight: 700,
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    Horaires
                  </th>
                ) : null}
                {days.map((day) => (
                  <th
                    key={day}
                    style={{
                      padding: "14px 10px",
                      borderRadius: 16,
                      background: theme.tableHeaderBg,
                      color: theme.tableHeaderText,
                      fontSize: TIME_FONT_PX + 1,
                      fontWeight: 700,
                      textAlign: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.start}`} style={{ height: rowHeight }}>
                  {customization.showTimes ? (
                    <td
                      style={{
                        verticalAlign: "middle",
                        textAlign: "center",
                        borderRadius: 16,
                        background: theme.timeColumnBg,
                        border: `1px solid ${theme.borderColor}`,
                        fontSize: TIME_FONT_PX,
                        fontWeight: 700,
                        color: theme.headerText,
                        padding: "10px 8px",
                        fontFamily: theme.fontFamily,
                      }}
                    >
                      <div>{row.start}</div>
                      <div
                        style={{
                          fontSize: TIME_FONT_PX - 1,
                          fontWeight: 500,
                          color: theme.mutedText,
                          marginTop: 4,
                        }}
                      >
                        {row.end}
                      </div>
                    </td>
                  ) : null}

                  {row.kind === "break" ? (
                    <td
                      colSpan={days.length}
                      style={{ padding: 0, verticalAlign: "stretch", height: rowHeight }}
                    >
                      <ScheduleCard
                        slot={row.slot}
                        theme={theme}
                        customization={customization}
                        variant="break"
                        cellWidth={contentWidth - timeColWidth - TABLE_GAP}
                        cellHeight={rowHeight}
                      />
                    </td>
                  ) : (
                    row.cells.map((cell, index) => (
                      <td
                        key={`${row.start}-${days[index]}`}
                        style={{
                          padding: 0,
                          verticalAlign: "stretch",
                          height: rowHeight,
                          width: cellWidth,
                        }}
                      >
                        {cell ? (
                          <ScheduleCard
                            slot={cell}
                            theme={theme}
                            customization={customization}
                            cellWidth={cellWidth}
                            cellHeight={rowHeight}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              minHeight: rowHeight,
                              borderRadius: 20,
                              border: `1.5px dashed ${theme.borderColor}`,
                              background: theme.cardBackground,
                            }}
                          />
                        )}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);
