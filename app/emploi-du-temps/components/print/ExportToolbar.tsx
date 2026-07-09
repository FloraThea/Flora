"use client";

import { useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import type { SmartTimetableSlot, TimetablePayload, TimetableSettings } from "@/lib/timetable/types";
import { VARIANT_LABELS } from "@/lib/timetable/types";
import { buildSchedulePrintMeta } from "@/lib/timetable/export";
import { PrintPreview } from "./PrintPreview";

type ExportToolbarProps = {
  payload: TimetablePayload;
  settings: TimetableSettings;
};

export function ExportToolbar({ payload, settings }: ExportToolbarProps) {
  const [open, setOpen] = useState(false);

  const meta = buildSchedulePrintMeta({
    scheduleName: payload.schedule.name,
    schoolYear: payload.schedule.schoolYear,
    levels: payload.schedule.levels,
    metadata: payload.schedule.metadata,
    variantLabel: VARIANT_LABELS[payload.schedule.variantType],
  });

  return (
    <>
      <FloraButton accent="cream" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        🖨️ Exporter
      </FloraButton>

      {open ? (
        <PrintPreview
          slots={payload.slots as SmartTimetableSlot[]}
          settings={settings}
          meta={meta}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
