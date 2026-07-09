"use client";

import { useCallback, useEffect, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import type {
  TimetableHistoryEntry,
  TimetablePayload,
  TimetableSettings,
  TimetableVariant,
  TimetableVersion,
} from "@/lib/timetable/types";
import { TIMETABLE_VARIANTS, VARIANT_LABELS } from "@/lib/timetable/types";
import { colors } from "@/lib/theme";
import { TimetableConfigPanel } from "./TimetableConfigPanel";
import { TimetableGrid } from "./TimetableGrid";
import { TimetableHistoryPanel } from "./TimetableHistoryPanel";
import { TimetableVersionsPanel } from "./TimetableVersionsPanel";
import { TimetableImportWizard } from "./TimetableImportWizard";
import { TimetableSlotEditor } from "./TimetableSlotEditor";
import { ExportToolbar } from "./print/ExportToolbar";
import type { SmartTimetableSlot } from "@/lib/timetable/types";

export function EmploiDuTempsPage() {
  const [payload, setPayload] = useState<TimetablePayload | null>(null);
  const [settings, setSettings] = useState<TimetableSettings | null>(null);
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [history, setHistory] = useState<TimetableHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "config" | "versions">("grid");
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SmartTimetableSlot | null>(null);
  const [isSavingSlot, setIsSavingSlot] = useState(false);

  const scheduleId = payload?.schedule.id;

  const loadMeta = useCallback(async (id: string) => {
    const [versionsRes, historyRes] = await Promise.all([
      fetch(`/api/emploi-du-temps/versions?scheduleId=${encodeURIComponent(id)}`),
      fetch(`/api/emploi-du-temps/history?scheduleId=${encodeURIComponent(id)}`),
    ]);

    const versionsData = (await versionsRes.json()) as { versions?: TimetableVersion[] };
    const historyData = (await historyRes.json()) as { history?: TimetableHistoryEntry[] };

    setVersions(versionsData.versions ?? []);
    setHistory(historyData.history ?? []);
  }, []);

  const loadTimetable = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/emploi-du-temps");
      const data = (await response.json()) as TimetablePayload & { error?: string };

      if (!response.ok) throw new Error(data.error || "Chargement impossible.");

      setPayload(data);
      setSettings(data.schedule.settings);
      await loadMeta(data.schedule.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement.");
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [loadMeta]);

  useEffect(() => {
    void loadTimetable();
  }, [loadTimetable]);

  async function handleGenerate(variantType?: TimetableVariant) {
    if (!scheduleId) return;
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/emploi-du-temps/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          variantType: variantType ?? payload?.schedule.variantType,
          preserveLocks: true,
          settings: settings ?? undefined,
        }),
      });

      const data = (await response.json()) as TimetablePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Génération impossible.");

      setPayload(data);
      setSettings(data.schedule.settings);
      await loadMeta(data.schedule.id);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Erreur de génération.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveSettings() {
    if (!scheduleId || !settings) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/emploi-du-temps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, settings }),
      });

      const data = (await response.json()) as TimetablePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Sauvegarde impossible.");

      setPayload(data);
      setSettings(data.schedule.settings);
      await loadMeta(scheduleId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erreur de sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMoveSlot(
    slotId: string,
    targetDay: string,
    targetStart: string,
    targetEnd: string,
  ) {
    if (!scheduleId) return;

    const response = await fetch("/api/emploi-du-temps/slots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId, slotId, targetDay, targetStart, targetEnd }),
    });

    const data = (await response.json()) as TimetablePayload & { error?: string };
    if (!response.ok) {
      setError(data.error || "Déplacement impossible.");
      return;
    }

    setPayload(data);
    await loadMeta(scheduleId);
  }

  async function handleUpdateSlot(
    patch: {
      subject: string;
      subSubject: string;
      customText: string;
      color: string;
      gradient: string;
    },
  ) {
    if (!scheduleId || !editingSlot) return;
    setIsSavingSlot(true);
    setError(null);

    try {
      const response = await fetch("/api/emploi-du-temps/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          slotId: editingSlot.id,
          ...patch,
        }),
      });

      const data = (await response.json()) as TimetablePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");

      setPayload(data);
      setEditingSlot(null);
      await loadMeta(scheduleId);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Mise à jour impossible.");
    } finally {
      setIsSavingSlot(false);
    }
  }

  async function handleLock(scope: "session" | "full_day", day: string, slotId?: string) {
    if (!scheduleId) return;

    const response = await fetch("/api/emploi-du-temps/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleId,
        scope,
        day,
        slotId,
        locked: true,
      }),
    });

    const data = (await response.json()) as TimetablePayload & { error?: string };
    if (!response.ok) {
      setError(data.error || "Verrouillage impossible.");
      return;
    }

    setPayload(data);
    await loadMeta(scheduleId);
  }

  async function handleSaveVersion() {
    if (!scheduleId) return;

    const response = await fetch("/api/emploi-du-temps/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId, label: `Sauvegarde ${new Date().toLocaleDateString("fr-FR")}` }),
    });

    if (!response.ok) return;
    await loadMeta(scheduleId);
  }

  async function handleRestoreVersion(versionId: string) {
    const response = await fetch("/api/emploi-du-temps/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restoreVersionId: versionId }),
    });

    const data = (await response.json()) as TimetablePayload & { error?: string };
    if (!response.ok) {
      setError(data.error || "Restauration impossible.");
      return;
    }

    setPayload(data);
    setSettings(data.schedule.settings);
    if (data.schedule.id) await loadMeta(data.schedule.id);
  }

  return (
    <div>
      <FloraPageTitle
        title="Emploi du temps intelligent"
        subtitle="Générez un emploi du temps hebdomadaire cohérent à partir du BO, de vos programmations, rituels et contraintes."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {payload ? (
          <FloraBadge accent={payload.validation.valid ? "sage" : "rose"}>
            {payload.validation.valid ? "Valide" : "Conflits détectés"}
          </FloraBadge>
        ) : null}
        {payload ? (
          <FloraBadge accent="lavender">
            {VARIANT_LABELS[payload.schedule.variantType]}
          </FloraBadge>
        ) : null}
        {payload?.schedule.levels.length ? (
          <FloraBadge accent="cream">{payload.schedule.levels.join(" · ")}</FloraBadge>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TIMETABLE_VARIANTS.map((variant) => (
          <FloraButton
            key={variant}
            accent="sage"
            variant={payload?.schedule.variantType === variant ? "primary" : "secondary"}
            size="sm"
            onClick={() => void handleGenerate(variant)}
            disabled={isGenerating}
          >
            {VARIANT_LABELS[variant]}
          </FloraButton>
        ))}
        <FloraButton
          accent="lavender"
          variant="secondary"
          onClick={() => setShowImportWizard(true)}
        >
          Importer mon emploi du temps
        </FloraButton>
        <FloraButton
          accent="rose"
          onClick={() => void handleGenerate()}
          disabled={isGenerating || !scheduleId}
        >
          {isGenerating ? "Génération…" : "Générer automatiquement"}
        </FloraButton>
        {payload && settings ? <ExportToolbar payload={payload} settings={settings} /> : null}
      </div>

      <div className="mb-6 flex gap-2">
        {(["grid", "config", "versions"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-1.5 text-sm font-light ${
              activeTab === tab
                ? "bg-white/70 text-flora-text"
                : "bg-white/30 text-flora-text-subtle hover:bg-white/50"
            }`}
          >
            {tab === "grid" ? "Grille" : tab === "config" ? "Paramètres" : "Versions"}
          </button>
        ))}
      </div>

      {error ? (
        <FloraCard padding="md" accent="rose" className="mb-6">
          <p className="text-sm font-light text-[#b88989]">{error}</p>
        </FloraCard>
      ) : null}

      {isLoading ? (
        <p className="text-sm font-light text-flora-text-subtle">Chargement de l&apos;emploi du temps…</p>
      ) : payload && settings ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {activeTab === "grid" ? (
              <FloraCard padding="lg">
                <TimetableGrid
                  slots={payload.slots}
                  settings={settings}
                  onMoveSlot={handleMoveSlot}
                  onLockSlot={(slotId, day) => void handleLock("session", day, slotId)}
                  onLockDay={(day) => void handleLock("full_day", day)}
                  onEditSlot={setEditingSlot}
                />
              </FloraCard>
            ) : null}

            {activeTab === "config" ? (
              <TimetableConfigPanel
                settings={settings}
                weeklyHours={payload.schedule.weeklyHours}
                onChange={setSettings}
                onSave={() => void handleSaveSettings()}
                isSaving={isSaving}
              />
            ) : null}

            {activeTab === "versions" ? (
              <TimetableVersionsPanel
                versions={versions}
                onSaveVersion={() => void handleSaveVersion()}
                onRestore={(id) => void handleRestoreVersion(id)}
                isLoading={false}
              />
            ) : null}

            {payload.validation.conflicts.length > 0 ? (
              <FloraCard padding="md" accent="rose" className="mt-6">
                <h4 className="font-serif text-lg font-medium" style={{ color: colors.charcoal.DEFAULT }}>
                  Conflits et alertes
                </h4>
                <ul className="mt-3 space-y-2">
                  {payload.validation.conflicts.map((conflict, index) => (
                    <li
                      key={`${conflict.code}-${index}`}
                      className={`text-sm font-light ${
                        conflict.severity === "error" ? "text-[#b88989]" : "text-[#c49a88]"
                      }`}
                    >
                      {conflict.message}
                    </li>
                  ))}
                </ul>
              </FloraCard>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4">
            <FloraCard padding="md" accent="sage">
              <h4 className="font-serif text-lg font-medium">Heures placées</h4>
              <div className="mt-3 space-y-1 text-xs font-light text-flora-text-muted">
                {Object.entries(payload.validation.weeklyHoursPlaced).map(([subject, hours]) => {
                  const target = payload.validation.weeklyHoursTarget[subject];
                  return (
                    <p key={subject}>
                      {subject} : {hours}h
                      {target ? ` / ${target}h BO` : ""}
                    </p>
                  );
                })}
              </div>
            </FloraCard>

            <TimetableHistoryPanel history={history} isLoading={false} />
          </aside>
        </div>
      ) : (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Importez votre Excel ou générez automatiquement un emploi du temps.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <FloraButton accent="lavender" onClick={() => setShowImportWizard(true)}>
              Importer mon emploi du temps
            </FloraButton>
            <FloraButton accent="sage" onClick={() => void handleGenerate()}>
              Créer mon emploi du temps
            </FloraButton>
          </div>
        </FloraCard>
      )}

      {editingSlot ? (
        <TimetableSlotEditor
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSave={handleUpdateSlot}
          isSaving={isSavingSlot}
        />
      ) : null}

      {showImportWizard ? (
        <TimetableImportWizard
          onClose={() => setShowImportWizard(false)}
          onComplete={(data) => {
            setPayload(data);
            setSettings(data.schedule.settings);
            setShowImportWizard(false);
            setActiveTab("grid");
            void loadMeta(data.schedule.id);
          }}
        />
      ) : null}
    </div>
  );
}
