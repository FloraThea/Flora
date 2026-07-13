"use client";

import { useEffect, useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { TimetableSlotCard } from "./TimetableSlotCard";
import type { SmartTimetableSlot, TimetableSlotUpdateInput } from "@/lib/timetable/types";
import { SCHOOL_DAYS } from "@/lib/timetable/types";
import {
  TIMETABLE_SUBJECTS,
  getSubSubjectsForSubject,
  resolveSlotAppearance,
} from "@/lib/timetable/subject-palette";
import { applySubjectMapping } from "@/lib/timetable/import/subject-mapper";
import { minutesBetween } from "@/lib/journal/date-utils";
import { addMinutes } from "@/lib/timetable/time-grid";
import {
  detectSlotConflicts,
  durationMinutes,
  readSlotMeta,
  type SlotLevel,
} from "@/lib/timetable/slot-editor/operations";
import {
  SLOT_ICON_OPTIONS,
  SLOT_LEVELS,
  defaultIconForSlot,
  formatDurationLabel,
} from "@/lib/timetable/slot-editor/constants";
import { useFloraTheme } from "@/components/theme/ThemeProvider";

function normalizeSubject(value: string): string {
  if ((TIMETABLE_SUBJECTS as readonly string[]).includes(value)) return value;
  const mapped = applySubjectMapping(value);
  if ((TIMETABLE_SUBJECTS as readonly string[]).includes(mapped.subject)) return mapped.subject;
  return TIMETABLE_SUBJECTS[0];
}

export type TimetableSlotDrawerProps = {
  slot: SmartTimetableSlot;
  allSlots: SmartTimetableSlot[];
  isCreate?: boolean;
  onClose: () => void;
  onSave: (patch: TimetableSlotUpdateInput) => Promise<void>;
  onAction: (action: Record<string, unknown>) => Promise<void>;
  isSaving?: boolean;
};

const inputClass =
  "mt-1 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm text-flora-text";

export function TimetableSlotDrawer({
  slot,
  allSlots,
  isCreate = false,
  onClose,
  onSave,
  onAction,
  isSaving,
}: TimetableSlotDrawerProps) {
  const { themeId } = useFloraTheme();
  const initialMeta = readSlotMeta(slot);

  const [day, setDay] = useState(slot.day);
  const [start, setStart] = useState(slot.start);
  const [end, setEnd] = useState(slot.end);
  const [subject, setSubject] = useState(() => normalizeSubject(slot.subject));
  const [subSubject, setSubSubject] = useState(slot.subSubject);
  const [displayText, setDisplayText] = useState(initialMeta.displayText ?? "");
  const [customText, setCustomText] = useState(slot.customText ?? "");
  const [levels, setLevels] = useState<SlotLevel[]>(initialMeta.levels ?? []);
  const [icon, setIcon] = useState(
    initialMeta.icon ?? defaultIconForSlot(slot.subject, slot.subSubject, slot.slotType),
  );
  const [useCustomColor, setUseCustomColor] = useState(initialMeta.useCustomColor ?? false);
  const [customColor, setCustomColor] = useState(slot.color || "#9caf88");
  const [room, setRoom] = useState(slot.room ?? "");
  const [teacherName, setTeacherName] = useState(
    initialMeta.teacherName ?? slot.intervenant ?? "",
  );
  const [notes, setNotes] = useState(initialMeta.notes ?? "");
  const [shiftFollowing, setShiftFollowing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReorganize, setDeleteReorganize] = useState<boolean | null>(null);
  const [splitTime, setSplitTime] = useState("");
  const [splitSecondSubject, setSplitSecondSubject] = useState(subject);
  const [showSplit, setShowSplit] = useState(false);

  useEffect(() => {
    const meta = readSlotMeta(slot);
    setDay(slot.day);
    setStart(slot.start);
    setEnd(slot.end);
    setSubject(normalizeSubject(slot.subject));
    setSubSubject(slot.subSubject);
    setDisplayText(meta.displayText ?? "");
    setCustomText(slot.customText ?? "");
    setLevels(meta.levels ?? []);
    setIcon(meta.icon ?? defaultIconForSlot(slot.subject, slot.subSubject, slot.slotType));
    setUseCustomColor(meta.useCustomColor ?? false);
    setCustomColor(slot.color || "#9caf88");
    setRoom(slot.room ?? "");
    setTeacherName(meta.teacherName ?? slot.intervenant ?? "");
    setNotes(meta.notes ?? "");
    setShiftFollowing(false);
    setShowDeleteConfirm(false);
    setDeleteReorganize(null);
    setShowSplit(false);
  }, [slot]);

  const subSubjects = useMemo(() => getSubSubjectsForSubject(subject), [subject]);
  const duration = durationMinutes(start, end);
  const timesChanged = start !== slot.start || end !== slot.end;

  const nextSlot = useMemo(() => {
    const daySlots = allSlots
      .filter((s) => s.day === slot.day && s.id !== slot.id)
      .sort((a, b) => a.start.localeCompare(b.start));
    return daySlots.find((s) => s.start >= slot.end) ?? null;
  }, [allSlots, slot]);

  const autoAppearance = useMemo(
    () => resolveSlotAppearance({ subject, subSubject, slotType: slot.slotType }, themeId),
    [subject, subSubject, slot.slotType, themeId],
  );

  const previewSlot: SmartTimetableSlot = useMemo(() => {
    const appearance = useCustomColor
      ? {
          color: customColor,
          gradient: `linear-gradient(145deg, ${customColor}88 0%, ${customColor} 100%)`,
        }
      : autoAppearance;

    return {
      ...slot,
      day,
      start,
      end,
      subject,
      subSubject,
      customText,
      color: appearance.color,
      gradient: appearance.gradient,
      room,
      intervenant: teacherName,
      metadata: {
        ...slot.metadata,
        icon,
        levels,
        displayText,
        notes,
        useCustomColor,
        teacherName,
      },
    };
  }, [
    slot,
    day,
    start,
    end,
    subject,
    subSubject,
    customText,
    useCustomColor,
    customColor,
    autoAppearance,
    room,
    teacherName,
    icon,
    levels,
    displayText,
    notes,
  ]);

  const previewConflicts = useMemo(() => {
    const others = isCreate ? allSlots : allSlots.filter((s) => s.id !== slot.id);
    return detectSlotConflicts([...others, previewSlot]);
  }, [allSlots, previewSlot, slot.id, isCreate]);

  function handleSubjectChange(nextSubject: string) {
    setSubject(nextSubject);
    setSubSubject("");
    if (!useCustomColor) {
      setIcon(defaultIconForSlot(nextSubject, "", slot.slotType));
    }
  }

  function handleDurationChange(minutes: number) {
    if (minutes > 0) setEnd(addMinutes(start, minutes));
  }

  function toggleLevel(level: SlotLevel) {
    setLevels((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
    );
  }

  async function handleSave() {
    await onSave({
      scheduleId: slot.scheduleId,
      slotId: slot.id,
      day,
      start,
      end,
      subject,
      subSubject,
      customText,
      displayText,
      color: useCustomColor ? customColor : autoAppearance.color,
      gradient: useCustomColor
        ? `linear-gradient(145deg, ${customColor}88 0%, ${customColor} 100%)`
        : autoAppearance.gradient,
      useCustomColor,
      icon,
      levels,
      notes,
      room,
      intervenant: teacherName,
      teacherName,
      shiftFollowing: timesChanged ? shiftFollowing : undefined,
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Fermer l'éditeur"
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/60 bg-[var(--flora-surface)] shadow-2xl transition-transform duration-300 ease-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-drawer-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/50 px-5 py-4">
          <div>
            <h2 id="slot-drawer-title" className="font-serif text-xl font-medium text-flora-text">
              {isCreate ? "Nouvelle plage" : "Modifier le créneau"}
            </h2>
            <p className="text-sm font-light text-flora-text-muted">
              {isCreate
                ? "Renseignez tous les champs puis créez la plage."
                : `${slot.day} · ${slot.start} – ${slot.end}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-flora-text-subtle transition hover:bg-white/50 hover:text-flora-text"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-5 transition-transform duration-200">
            <TimetableSlotCard slot={previewSlot} />
          </div>

          {previewConflicts.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm font-light text-[#b88989]">
              <p className="font-medium">⚠ Conflit détecté</p>
              <p className="mt-1">{previewConflicts[0]?.message}</p>
              <p className="mt-1 text-xs opacity-80">
                Ajustez les horaires ou déplacez le créneau pour corriger.
              </p>
            </div>
          ) : null}

          <div className="space-y-4">
            <fieldset className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-light text-flora-text-muted">
                Jour
                <select className={inputClass} value={day} onChange={(e) => setDay(e.target.value)}>
                  {SCHOOL_DAYS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-light text-flora-text-muted">
                Durée
                <select
                  className={inputClass}
                  value={duration}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                >
                  {[15, 30, 45, 60, 75, 90, 105, 120].map((mins) => (
                    <option key={mins} value={mins}>
                      {formatDurationLabel(mins)}
                    </option>
                  ))}
                  <option value={duration}>{formatDurationLabel(duration)} (actuelle)</option>
                </select>
              </label>
            </fieldset>

            <fieldset className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-light text-flora-text-muted">
                Début
                <input
                  type="time"
                  className={inputClass}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="block text-sm font-light text-flora-text-muted">
                Fin
                <input
                  type="time"
                  className={inputClass}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </fieldset>

            {timesChanged ? (
              <label className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-sm font-light text-flora-text-muted">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={shiftFollowing}
                  onChange={(e) => setShiftFollowing(e.target.checked)}
                />
                <span>
                  Réorganiser automatiquement les créneaux suivants
                  <span className="mt-0.5 block text-xs text-flora-text-subtle">
                    Décale les horaires des cartes suivantes sur {day}.
                  </span>
                </span>
              </label>
            ) : null}

            <label className="block text-sm font-light text-flora-text-muted">
              Matière
              <select
                className={inputClass}
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
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
                className={inputClass}
                value={subSubject}
                onChange={(e) => setSubSubject(e.target.value)}
              >
                <option value="">— Aucune —</option>
                {subSubjects.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="text-sm font-light text-flora-text-muted">Niveau concerné</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SLOT_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleLevel(level)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      levels.includes(level)
                        ? "bg-[var(--flora-accent-sage)] text-white"
                        : "bg-white/50 text-flora-text-subtle hover:bg-white/70"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-light text-flora-text-muted">
              Texte affiché
              <input
                className={inputClass}
                placeholder="Titre visible sur la carte"
                value={displayText}
                onChange={(e) => setDisplayText(e.target.value)}
              />
            </label>

            <label className="block text-sm font-light text-flora-text-muted">
              Texte complémentaire
              <textarea
                className={`${inputClass} min-h-[72px]`}
                placeholder="Consignes, groupe, précisions…"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
            </label>

            <fieldset className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-light text-flora-text-muted">
                Icône
                <select className={inputClass} value={icon} onChange={(e) => setIcon(e.target.value)}>
                  {SLOT_ICON_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-light text-flora-text-muted">
                Salle <span className="text-flora-text-subtle">(facultatif)</span>
                <input className={inputClass} value={room} onChange={(e) => setRoom(e.target.value)} />
              </label>
            </fieldset>

            <label className="block text-sm font-light text-flora-text-muted">
              Enseignant <span className="text-flora-text-subtle">(facultatif)</span>
              <input
                className={inputClass}
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
              />
            </label>

            <label className="block text-sm font-light text-flora-text-muted">
              Notes
              <textarea
                className={`${inputClass} min-h-[64px]`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <div className="rounded-2xl border border-white/60 bg-white/35 px-4 py-3">
              <label className="flex items-center gap-3 text-sm font-light text-flora-text-muted">
                <input
                  type="checkbox"
                  checked={useCustomColor}
                  onChange={(e) => setUseCustomColor(e.target.checked)}
                />
                Utiliser une couleur personnelle
              </label>
              {useCustomColor ? (
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-xl border border-white/60"
                  />
                  <span className="text-xs text-flora-text-subtle">{customColor}</span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-flora-text-subtle">
                  Couleur automatique selon la matière et le thème actif.
                </p>
              )}
            </div>

            {!isCreate ? (
              <>
            <div className="flex flex-wrap gap-2 border-t border-white/40 pt-4">
              <FloraButton
                accent="cream"
                variant="secondary"
                size="sm"
                onClick={() => void onAction({ action: "move", direction: "up" })}
              >
                ⬆ Monter
              </FloraButton>
              <FloraButton
                accent="cream"
                variant="secondary"
                size="sm"
                onClick={() => void onAction({ action: "move", direction: "down" })}
              >
                ⬇ Descendre
              </FloraButton>
              <FloraButton
                accent="lavender"
                variant="secondary"
                size="sm"
                onClick={() => void onAction({ action: "duplicate" })}
              >
                📄 Dupliquer
              </FloraButton>
              {nextSlot ? (
                <FloraButton
                  accent="sage"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    void onAction({
                      action: "merge",
                      targetSlotId: nextSlot.id,
                    })
                  }
                >
                  Fusionner avec le suivant
                </FloraButton>
              ) : null}
              <FloraButton
                accent="cream"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const mid = addMinutes(start, Math.floor(minutesBetween(start, end) / 2));
                  setSplitTime(mid);
                  setSplitSecondSubject(subject);
                  setShowSplit(true);
                }}
              >
                Fractionner
              </FloraButton>
            </div>

            {showSplit ? (
              <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
                <p className="text-sm font-light text-flora-text-muted">Couper le créneau à :</p>
                <input
                  type="time"
                  className={`${inputClass} mb-3`}
                  value={splitTime}
                  onChange={(e) => setSplitTime(e.target.value)}
                />
                <label className="block text-sm font-light text-flora-text-muted">
                  Matière du 2ᵉ créneau
                  <select
                    className={inputClass}
                    value={splitSecondSubject}
                    onChange={(e) => setSplitSecondSubject(e.target.value)}
                  >
                    {TIMETABLE_SUBJECTS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex gap-2">
                  <FloraButton
                    accent="sage"
                    size="sm"
                    onClick={() =>
                      void onAction({
                        action: "split",
                        splitTime,
                        secondSubject: splitSecondSubject,
                      })
                    }
                  >
                    Confirmer la coupe
                  </FloraButton>
                  <FloraButton accent="cream" variant="secondary" size="sm" onClick={() => setShowSplit(false)}>
                    Annuler
                  </FloraButton>
                </div>
              </div>
            ) : null}

            {!showDeleteConfirm ? (
              <FloraButton
                accent="rose"
                variant="secondary"
                className="w-full"
                onClick={() => setShowDeleteConfirm(true)}
              >
                🗑 Supprimer cette carte
              </FloraButton>
            ) : (
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/60 p-4">
                <p className="text-sm font-light text-[#b88989]">
                  Confirmer la suppression de ce créneau ?
                </p>
                <p className="mt-2 text-xs text-flora-text-subtle">Que faire de l&apos;horaire libéré ?</p>
                <div className="mt-3 flex flex-col gap-2">
                  <FloraButton
                    accent="rose"
                    size="sm"
                    onClick={() => void onAction({ action: "delete", reorganize: true })}
                  >
                    Réorganiser automatiquement les horaires
                  </FloraButton>
                  <FloraButton
                    accent="cream"
                    variant="secondary"
                    size="sm"
                    onClick={() => void onAction({ action: "delete", reorganize: false })}
                  >
                    Conserver un créneau vide
                  </FloraButton>
                  <FloraButton
                    accent="cream"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Annuler
                  </FloraButton>
                </div>
              </div>
            )}
              </>
            ) : null}
          </div>
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-white/50 px-5 py-4">
          <FloraButton accent="cream" variant="secondary" className="flex-1" onClick={onClose}>
            Fermer
          </FloraButton>
          <FloraButton
            accent="sage"
            className="flex-1"
            disabled={isSaving || previewConflicts.some((c) => c.severity === "error")}
            onClick={() => void handleSave()}
          >
            {isSaving ? "Enregistrement…" : isCreate ? "Créer la plage" : "Enregistrer"}
          </FloraButton>
        </footer>
      </aside>
    </>
  );
}
