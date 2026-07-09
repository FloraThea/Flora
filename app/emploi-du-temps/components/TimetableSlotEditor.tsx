"use client";

import { useEffect, useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { TimetableSlotCard } from "./TimetableSlotCard";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import {
  TIMETABLE_SUBJECTS,
  buildSubjectGradient,
  getSubSubjectsForSubject,
  getSubjectBaseColor,
  resolveSlotAppearance,
} from "@/lib/timetable/subject-palette";

type TimetableSlotEditorProps = {
  slot: SmartTimetableSlot;
  onClose: () => void;
  onSave: (patch: {
    subject: string;
    subSubject: string;
    customText: string;
    color: string;
    gradient: string;
  }) => Promise<void>;
  isSaving?: boolean;
};

export function TimetableSlotEditor({ slot, onClose, onSave, isSaving }: TimetableSlotEditorProps) {
  const [subject, setSubject] = useState(slot.subject);
  const [subSubject, setSubSubject] = useState(slot.subSubject);
  const [customText, setCustomText] = useState(slot.customText ?? "");

  useEffect(() => {
    setSubject(slot.subject);
    setSubSubject(slot.subSubject);
    setCustomText(slot.customText ?? "");
  }, [slot]);

  const subSubjects = useMemo(() => getSubSubjectsForSubject(subject), [subject]);

  const previewSlot: SmartTimetableSlot = useMemo(() => {
    const appearance = resolveSlotAppearance({
      subject,
      subSubject,
      slotType: slot.slotType,
      color: getSubjectBaseColor(subject, slot.slotType),
      gradient: buildSubjectGradient(subject, subSubject, slot.slotType),
    });

    return {
      ...slot,
      subject,
      subSubject,
      customText,
      color: appearance.color,
      gradient: appearance.gradient,
    };
  }, [slot, subject, subSubject, customText]);

  function handleSubjectChange(nextSubject: string) {
    setSubject(nextSubject);
    const options = getSubSubjectsForSubject(nextSubject);
    if (subSubject && !options.includes(subSubject)) {
      setSubSubject("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" accent="sage" className="w-full max-w-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl font-medium text-flora-text">Modifier le créneau</h3>
            <p className="text-sm font-light text-flora-text-muted">
              {slot.day} · {slot.start} – {slot.end}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-flora-text-subtle hover:text-flora-text">
            ✕
          </button>
        </div>

        <div className="mb-5">
          <TimetableSlotCard slot={previewSlot} />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-light text-flora-text-muted">
            Matière
            <select
              className="mt-1 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm"
              value={subject}
              onChange={(event) => handleSubjectChange(event.target.value)}
            >
              {TIMETABLE_SUBJECTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-light text-flora-text-muted">
            Sous-matière
            <select
              className="mt-1 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm"
              value={subSubject}
              onChange={(event) => setSubSubject(event.target.value)}
            >
              <option value="">— Aucune —</option>
              {subSubjects.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-light text-flora-text-muted">
            Texte libre
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm"
              placeholder="Ex. : Atelier lecture, groupe CE1, consignes particulières…"
              value={customText}
              onChange={(event) => setCustomText(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <FloraButton accent="cream" variant="secondary" onClick={onClose}>
            Annuler
          </FloraButton>
          <FloraButton
            accent="sage"
            disabled={isSaving}
            onClick={() =>
              void onSave({
                subject,
                subSubject,
                customText,
                color: previewSlot.color,
                gradient: previewSlot.gradient,
              })
            }
          >
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </FloraButton>
        </div>
      </FloraCard>
    </div>
  );
}
