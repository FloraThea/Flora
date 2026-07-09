"use client";

import { forwardRef, useMemo } from "react";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import {
  buildPrintScheduleRows,
  resolvePrintDays,
} from "@/lib/timetable/export/print-layout-engine";
import { getPrintThemeTokens } from "@/lib/timetable/export/print-theme";
import {
  A4_LANDSCAPE_PX,
  A4_PORTRAIT_PX,
  type PrintCustomization,
  type SchedulePrintMeta,
} from "@/lib/timetable/export/types";
import { PrintHeader } from "./PrintHeader";
import { ScheduleCard } from "./ScheduleCard";

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
    const headerHeight = 280;
    const tableHeight = dimensions.height - headerHeight - 80;
    const rowHeight = Math.max(64, Math.floor(tableHeight / Math.max(rows.length, 1)));

    return (
      <div
        ref={ref}
        className="flora-print-document"
        style={{
          position: "relative",
          width: dimensions.width,
          height: dimensions.height,
          boxSizing: "border-box",
          padding: "48px 44px 40px",
          background: theme.pageBackground,
          color: theme.headerText,
          fontFamily: theme.fontFamily,
          overflow: "hidden",
        }}
      >
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <WatermarkLayer opacity={theme.watermarkOpacity} />

        <PrintHeader meta={meta} theme={theme} />

        <div style={{ position: "relative", zIndex: 1, height: tableHeight }}>
          <table
            style={{
              width: "100%",
              height: "100%",
              borderCollapse: "separate",
              borderSpacing: 8,
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr>
                {customization.showTimes ? (
                  <th
                    style={{
                      width: 110,
                      padding: "12px 8px",
                      borderRadius: 14,
                      background: theme.timeColumnBg,
                      color: theme.headerText,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Horaires
                  </th>
                ) : null}
                {days.map((day) => (
                  <th
                    key={day}
                    style={{
                      padding: "12px 8px",
                      borderRadius: 14,
                      background: theme.tableHeaderBg,
                      color: theme.tableHeaderText,
                      fontSize: 14,
                      fontWeight: 700,
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
                        borderRadius: 14,
                        background: theme.timeColumnBg,
                        border: `1px solid ${theme.borderColor}`,
                        fontSize: 13,
                        fontWeight: 700,
                        color: theme.headerText,
                        padding: 8,
                      }}
                    >
                      <div>{row.start}</div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: theme.mutedText,
                          marginTop: 2,
                        }}
                      >
                        {row.end}
                      </div>
                    </td>
                  ) : null}

                  {row.kind === "break" ? (
                    <td
                      colSpan={days.length}
                      style={{ padding: 4, verticalAlign: "middle" }}
                    >
                      <ScheduleCard
                        slot={row.slot}
                        theme={theme}
                        customization={customization}
                        variant="break"
                      />
                    </td>
                  ) : (
                    row.cells.map((cell, index) => (
                      <td
                        key={`${row.start}-${days[index]}`}
                        style={{ padding: 0, verticalAlign: "stretch" }}
                      >
                        {cell ? (
                          <ScheduleCard
                            slot={cell}
                            theme={theme}
                            customization={customization}
                          />
                        ) : (
                          <div
                            style={{
                              height: "100%",
                              minHeight: 64,
                              borderRadius: 16,
                              border: `1px dashed ${theme.borderColor}`,
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
