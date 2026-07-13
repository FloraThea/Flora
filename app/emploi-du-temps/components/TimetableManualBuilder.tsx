"use client";

import { useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { SmartTimetableSlot, TimetableSettings } from "@/lib/timetable/types";
import { SCHOOL_DAYS } from "@/lib/timetable/types";
import { TIMETABLE_SUBJECTS } from "@/lib/timetable/subject-palette";
import { detectSlotConflicts } from "@/lib/timetable/slot-editor/operations";
import { newSlotId } from "@/lib/timetable/slot-editor/operations";

export type ManualSlotRow = {
  id: string;
  day: string;
  start: string;
  end: string;
  subject: string;
  subSubject: string;
  displayText: string;
  customText: string;
};

type TimetableManualBuilderProps = {
  scheduleId: string;
  settings: TimetableSettings;
  existingSlots: SmartTimetableSlot[];
  onClose: () => void;
  onSave: (slots: SmartTimetableSlot[]) => Promise<void>;
  isSaving?: boolean;
};

const inputClass =
  "w-full min-w-0 rounded-xl border border-white/70 bg-white/60 px-2 py-1.5 text-xs text-flora-text";

function emptyRow(day: string, morningStart: string): ManualSlotRow {
  return {
    id: newSlotId(),
    day,
    start: morningStart,
    end: "09:30",
    subject: "Français",
    subSubject: "",
    displayText: "",
    customText: "",
  };
}

function slotsToRows(slots: SmartTimetableSlot[]): ManualSlotRow[] {
  return [...slots]
    .sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start))
    .map((slot) => ({
      id: slot.id,
      day: slot.day,
      start: slot.start,
      end: slot.end,
      subject: slot.subject,
      subSubject: slot.subSubject,
      displayText:
        typeof slot.metadata.displayText === "string" ? slot.metadata.displayText : "",
      customText: slot.customText ?? "",
    }));
}

function rowsToSlots(rows: ManualSlotRow[], scheduleId: string): SmartTimetableSlot[] {
  return rows
    .filter((row) => row.day && row.start && row.end && row.subject.trim())
    .map((row, index) => ({
      id: newSlotId(),
      scheduleId,
      day: row.day,
      start: row.start,
      end: row.end,
      subject: row.subject.trim(),
      subSubject: row.subSubject.trim(),
      customText: row.customText.trim(),
      color: "",
      gradient: "",
      slotType: "seance" as const,
      lockLevel: "none" as const,
      hours: 1,
      room: "",
      intervenant: "",
      label: row.subject.trim(),
      sortOrder: index,
      metadata: {
        displayText: row.displayText.trim(),
      },
    }));
}

export function TimetableManualBuilder({
  scheduleId,
  settings,
  existingSlots,
  onClose,
  onSave,
  isSaving,
}: TimetableManualBuilderProps) {
  const days = settings.schoolDays.length > 0 ? settings.schoolDays : [...SCHOOL_DAYS];
  const morningStart = settings.morningStart || "08:30";

  const [rows, setRows] = useState<ManualSlotRow[]>(() =>
    existingSlots.length > 0
      ? slotsToRows(existingSlots)
      : days.map((day) => emptyRow(day, morningStart)),
  );

  const previewSlots = useMemo(() => rowsToSlots(rows, scheduleId), [rows, scheduleId]);
  const conflicts = useMemo(() => detectSlotConflicts(previewSlots), [previewSlots]);

  function updateRow(id: string, patch: Partial<ManualSlotRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow(day?: string) {
    setRows((current) => [...current, emptyRow(day ?? days[0] ?? "Lundi", morningStart)]);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
  }

  function duplicateRow(id: string) {
    const source = rows.find((row) => row.id === id);
    if (!source) return;
    setRows((current) => [...current, { ...source, id: newSlotId() }]);
  }

  function applyDayTemplate(sourceDay: string) {
    const template = rows.filter((row) => row.day === sourceDay);
    if (template.length === 0) return;

    const others = days.filter((day) => day !== sourceDay);
    const generated = others.flatMap((day) =>
      template.map((row) => ({
        ...row,
        id: newSlotId(),
        day,
      })),
    );

    setRows([...template, ...generated]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" accent="sage" className="flex max-h-[90vh] w-full max-w-5xl flex-col">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl font-medium text-flora-text">Saisir mon emploi du temps</h3>
            <p className="text-sm font-light text-flora-text-muted">
              Créez toutes vos plages en renseignant jour, horaires et matières.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-flora-text-subtle hover:text-flora-text">
            ✕
          </button>
        </div>

        {conflicts.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm font-light text-[#b88989]">
            <p className="font-medium">⚠ {conflicts.length} conflit(s) horaire(s)</p>
            <p className="mt-1 text-xs">{conflicts[0]?.message}</p>
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap gap-2">
          <FloraButton accent="sage" variant="secondary" size="sm" onClick={() => addRow()}>
            + Ajouter une plage
          </FloraButton>
          {days[0] ? (
            <FloraButton
              accent="lavender"
              variant="secondary"
              size="sm"
              onClick={() => applyDayTemplate(days[0])}
            >
              Copier {days[0]} sur les autres jours
            </FloraButton>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-white/60 bg-white/30">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="sticky top-0 bg-white/80 backdrop-blur-sm">
              <tr className="text-flora-text-muted">
                <th className="px-2 py-2 font-light">Jour</th>
                <th className="px-2 py-2 font-light">Début</th>
                <th className="px-2 py-2 font-light">Fin</th>
                <th className="px-2 py-2 font-light">Matière</th>
                <th className="px-2 py-2 font-light">Sous-matière</th>
                <th className="px-2 py-2 font-light">Texte affiché</th>
                <th className="px-2 py-2 font-light">Complément</th>
                <th className="px-2 py-2 font-light" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-white/50">
                  <td className="px-2 py-1.5">
                    <select
                      className={inputClass}
                      value={row.day}
                      onChange={(e) => updateRow(row.id, { day: e.target.value })}
                    >
                      {days.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      className={inputClass}
                      value={row.start}
                      onChange={(e) => updateRow(row.id, { start: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="time"
                      className={inputClass}
                      value={row.end}
                      onChange={(e) => updateRow(row.id, { end: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <select
                      className={inputClass}
                      value={row.subject}
                      onChange={(e) => updateRow(row.id, { subject: e.target.value })}
                    >
                      {TIMETABLE_SUBJECTS.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={inputClass}
                      value={row.subSubject}
                      onChange={(e) => updateRow(row.id, { subSubject: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={inputClass}
                      value={row.displayText}
                      onChange={(e) => updateRow(row.id, { displayText: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={inputClass}
                      value={row.customText}
                      onChange={(e) => updateRow(row.id, { customText: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-lg px-1.5 py-1 text-[10px] text-flora-text-subtle hover:bg-white/60"
                        onClick={() => duplicateRow(row.id)}
                        title="Dupliquer"
                      >
                        📄
                      </button>
                      <button
                        type="button"
                        className="rounded-lg px-1.5 py-1 text-[10px] text-[#b88989] hover:bg-white/60"
                        onClick={() => removeRow(row.id)}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <FloraButton accent="cream" variant="secondary" onClick={onClose}>
            Annuler
          </FloraButton>
          <FloraButton
            accent="sage"
            disabled={isSaving || conflicts.some((c) => c.severity === "error") || previewSlots.length === 0}
            onClick={() => void onSave(previewSlots)}
          >
            {isSaving ? "Enregistrement…" : `Enregistrer ${previewSlots.length} plage(s)`}
          </FloraButton>
        </div>
      </FloraCard>
    </div>
  );
}
