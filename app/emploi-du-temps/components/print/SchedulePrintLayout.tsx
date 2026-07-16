"use client";

import { forwardRef, useMemo } from "react";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { resolvePrintDays } from "@/lib/timetable/export/print-layout-engine";
import {
  getPrintThemeTokens,
  PRINT_AXIS_TIME_FONT_PX,
} from "@/lib/timetable/export/print-theme";
import {
  resolvePageDimensions,
  type PrintCustomization,
  type SchedulePrintMeta,
} from "@/lib/timetable/export/types";
import {
  buildUniformExportGrid,
  estimateExportPageCount,
  type ExportGridRow,
} from "@/lib/timetable/export/export-grid-layout";
import { EXPORT_ROW_GAP_PX } from "@/lib/timetable/export/export-card-dimensions";
import { PrintHeader } from "./PrintHeader";
import { ScheduleCard } from "./ScheduleCard";

const PAGE_MARGIN_X = 40;
const PAGE_MARGIN_TOP = 36;
const PAGE_MARGIN_BOTTOM = 32;
const HEADER_BLOCK_HEIGHT = 220;
const TIME_COLUMN_WIDTH = 96;
const GRID_GAP_PX = 4;

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

function splitRowsIntoPages(rows: ExportGridRow[], availableHeightPx: number): ExportGridRow[][] {
  if (rows.length === 0) return [[]];

  const pages: ExportGridRow[][] = [];
  let current: ExportGridRow[] = [];
  let used = 0;

  for (const row of rows) {
    const rowTotal = row.rowHeightPx + EXPORT_ROW_GAP_PX;
    if (current.length > 0 && used + rowTotal > availableHeightPx) {
      pages.push(current);
      current = [row];
      used = rowTotal;
    } else {
      current.push(row);
      used += rowTotal;
    }
  }

  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

function ExportGridBody({
  rows,
  days,
  customization,
  theme,
  dayColumnWidth,
  tableHeight,
}: {
  rows: ExportGridRow[];
  days: string[];
  customization: PrintCustomization;
  theme: ReturnType<typeof getPrintThemeTokens>;
  dayColumnWidth: number;
  tableHeight: number;
}) {
  const timeColWidth = customization.showTimes ? TIME_COLUMN_WIDTH : 0;

  return (
    <div style={{ position: "relative", zIndex: 1, minHeight: tableHeight }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: customization.showTimes
            ? `${timeColWidth}px repeat(${days.length}, ${dayColumnWidth}px)`
            : `repeat(${days.length}, ${dayColumnWidth}px)`,
          gap: GRID_GAP_PX,
          marginBottom: GRID_GAP_PX,
        }}
      >
        {customization.showTimes ? <div /> : null}
        {days.map((day) => (
          <div
            key={day}
            style={{
              padding: "8px 6px",
              borderRadius: 12,
              background: theme.tableHeaderBg,
              color: theme.tableHeaderText,
              fontSize: PRINT_AXIS_TIME_FONT_PX,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: EXPORT_ROW_GAP_PX }}>
        {rows.map((row) => (
          <div
            key={`row-${row.start}`}
            style={{
              display: "grid",
              gridTemplateColumns: customization.showTimes
                ? `${timeColWidth}px repeat(${days.length}, ${dayColumnWidth}px)`
                : `repeat(${days.length}, ${dayColumnWidth}px)`,
              gap: GRID_GAP_PX,
              minHeight: row.rowHeightPx,
            }}
          >
            {customization.showTimes ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingTop: 8,
                  fontSize: PRINT_AXIS_TIME_FONT_PX,
                  fontWeight: 700,
                  color: theme.headerText,
                }}
              >
                {row.start}
              </div>
            ) : null}
            {row.cells.map(({ day, slot }) => (
              <div key={`${day}-${row.start}`} style={{ minHeight: row.rowHeightPx }}>
                {slot ? (
                  <ScheduleCard
                    slot={slot}
                    theme={theme}
                    customization={customization}
                    cellHeight={row.rowHeightPx}
                    cellWidth={dayColumnWidth - 4}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const SchedulePrintLayout = forwardRef<HTMLDivElement, SchedulePrintLayoutProps>(
  function SchedulePrintLayout({ slots, schoolDays, meta, customization }, ref) {
    const theme = getPrintThemeTokens(customization.styleTheme);
    const dimensions = resolvePageDimensions(customization);
    const days = useMemo(() => resolvePrintDays(schoolDays), [schoolDays]);

    const exportGrid = useMemo(
      () => buildUniformExportGrid(slots, days),
      [slots, days],
    );

    const contentWidth = dimensions.width - PAGE_MARGIN_X * 2;
    const tableHeight =
      dimensions.height - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM - HEADER_BLOCK_HEIGHT;
    const timeColWidth = customization.showTimes ? TIME_COLUMN_WIDTH : 0;
    const dayColumnWidth = Math.floor(
      (contentWidth - timeColWidth - GRID_GAP_PX * days.length) / days.length,
    );

    const pageCount = estimateExportPageCount({
      totalHeightPx: exportGrid.totalHeightPx,
      availableHeightPx: tableHeight,
    });
    const rowPages = useMemo(
      () => splitRowsIntoPages(exportGrid.rows, tableHeight),
      [exportGrid.rows, tableHeight],
    );

    return (
      <div ref={ref}>
        {rowPages.map((pageRows, pageIndex) => (
          <div
            key={`page-${pageIndex}`}
            className="flora-print-document"
            style={{
              position: "relative",
              width: dimensions.width,
              height: dimensions.height,
              boxSizing: "border-box",
              padding: `${PAGE_MARGIN_TOP}px ${PAGE_MARGIN_X}px ${PAGE_MARGIN_BOTTOM}px`,
              background: theme.pageBackground,
              color: theme.headerText,
              fontFamily: "var(--font-dm-sans, 'DM Sans', sans-serif)",
              overflow: "visible",
              pageBreakAfter: pageIndex < rowPages.length - 1 ? "always" : "auto",
            }}
          >
            <WatermarkLayer opacity={theme.watermarkOpacity} />
            <PrintHeader
              meta={{
                ...meta,
                scheduleName:
                  pageCount > 1
                    ? `${meta.scheduleName} — page ${pageIndex + 1}/${rowPages.length}`
                    : meta.scheduleName,
              }}
              theme={theme}
            />
            <ExportGridBody
              rows={pageRows}
              days={days}
              customization={customization}
              theme={theme}
              dayColumnWidth={dayColumnWidth}
              tableHeight={tableHeight}
            />
          </div>
        ))}
      </div>
    );
  },
);
