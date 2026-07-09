"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { TimetableSettings } from "@/lib/timetable/types";
import { SCHOOL_DAYS } from "@/lib/timetable/types";
import { colors } from "@/lib/theme";

const inputClass =
  "w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2.5 text-sm font-light text-flora-text outline-none focus:border-sauge/40";

type TimetableConfigPanelProps = {
  settings: TimetableSettings;
  weeklyHours: Record<string, number>;
  onChange: (settings: TimetableSettings) => void;
  onSave: () => void;
  isSaving: boolean;
};

export function TimetableConfigPanel({
  settings,
  weeklyHours,
  onChange,
  onSave,
  isSaving,
}: TimetableConfigPanelProps) {
  function updateField<K extends keyof TimetableSettings>(key: K, value: TimetableSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <FloraCard padding="lg" accent="cream">
      <h3 className="font-serif text-xl font-medium" style={{ color: colors.charcoal.DEFAULT }}>
        Paramétrage
      </h3>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Début matinée</span>
          <input
            type="time"
            className={inputClass}
            value={settings.morningStart}
            onChange={(event) => updateField("morningStart", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Fin matinée</span>
          <input
            type="time"
            className={inputClass}
            value={settings.morningEnd}
            onChange={(event) => updateField("morningEnd", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Début après-midi</span>
          <input
            type="time"
            className={inputClass}
            value={settings.afternoonStart}
            onChange={(event) => updateField("afternoonStart", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Fin après-midi</span>
          <input
            type="time"
            className={inputClass}
            value={settings.afternoonEnd}
            onChange={(event) => updateField("afternoonEnd", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Pause méridienne (début)</span>
          <input
            type="time"
            className={inputClass}
            value={settings.lunchBreak.start}
            onChange={(event) =>
              updateField("lunchBreak", { ...settings.lunchBreak, start: event.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Pause méridienne (fin)</span>
          <input
            type="time"
            className={inputClass}
            value={settings.lunchBreak.end}
            onChange={(event) =>
              updateField("lunchBreak", { ...settings.lunchBreak, end: event.target.value })
            }
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Durée séance (min)</span>
          <input
            type="number"
            min={30}
            max={180}
            className={inputClass}
            value={settings.defaultSessionMinutes}
            onChange={(event) =>
              updateField("defaultSessionMinutes", Number(event.target.value) || 60)
            }
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-light text-flora-text-subtle">Séances max / jour</span>
          <input
            type="number"
            min={1}
            max={10}
            className={inputClass}
            value={settings.maxSessionsPerDay}
            onChange={(event) =>
              updateField("maxSessionsPerDay", Number(event.target.value) || 6)
            }
          />
        </label>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-light text-flora-text-subtle">Jours de classe</p>
        <div className="flex flex-wrap gap-2">
          {SCHOOL_DAYS.map((day) => {
            const active = settings.schoolDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => {
                  const next = active
                    ? settings.schoolDays.filter((item) => item !== day)
                    : [...settings.schoolDays, day];
                  updateField("schoolDays", next.length > 0 ? next : [...SCHOOL_DAYS]);
                }}
                className={`rounded-full px-3 py-1 text-xs ${
                  active
                    ? "bg-sauge-light/50 text-sauge"
                    : "bg-white/40 text-flora-text-subtle"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {Object.keys(weeklyHours).length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-xs font-light text-flora-text-subtle">Heures hebdomadaires (BO)</p>
          <div className="grid grid-cols-2 gap-2 text-xs font-light text-flora-text-muted lg:grid-cols-3">
            {Object.entries(weeklyHours).map(([subject, hours]) => (
              <span key={subject}>
                {subject} : {hours}h
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <FloraButton accent="sage" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer les paramètres"}
        </FloraButton>
      </div>
    </FloraCard>
  );
}
