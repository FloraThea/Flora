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
  TimetableSlotUpdateInput,
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
import { TimetableSlotDrawer } from "./TimetableSlotDrawer";
import { TimetableManualBuilder } from "./TimetableManualBuilder";
import { ExportToolbar } from "./print/ExportToolbar";
import type { SmartTimetableSlot } from "@/lib/timetable/types";
import { useTimetableUndo } from "../hooks/useTimetableUndo";
import { buildDraftSlot, isDraftSlotId } from "@/lib/timetable/slot-editor/operations";

export function EmploiDuTempsPage() {
  const [payload, setPayload] = useState<TimetablePayload | null>(null);
  const [settings, setSettings] = useState<TimetableSettings | null>(null);
  const [versions, setVersions] = useState<TimetableVersion[]>([]);
  const [history, setHistory] = useState<TimetableHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "config" | "versions">("grid");
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SmartTimetableSlot | null>(null);
  const [createSlotContext, setCreateSlotContext] = useState<{ afterSlotId: string | null } | null>(
    null,
  );
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [isSavingSlot, setIsSavingSlot] = useState(false);

  const {
    canUndo,
    canRedo,
    pushSnapshot,
    commitUndo,
    commitRedo,
    resetHistory,
  } = useTimetableUndo();

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
      resetHistory();
      await loadMeta(data.schedule.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement.");
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [loadMeta, resetHistory]);

  useEffect(() => {
    void loadTimetable();
  }, [loadTimetable]);

  const applyPayload = useCallback(
    async (data: TimetablePayload, message?: string) => {
      setPayload(data);
      setSettings(data.schedule.settings);
      if (message) setSuccessMessage(message);
      await loadMeta(data.schedule.id);
    },
    [loadMeta],
  );

  const commitChange = useCallback(
    async (data: TimetablePayload, message?: string) => {
      if (payload) pushSnapshot(payload);
      await applyPayload(data, message);
    },
    [applyPayload, payload, pushSnapshot],
  );

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

      if (payload) pushSnapshot(payload);
      resetHistory();
      await applyPayload(data, "Emploi du temps régénéré");
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

      await applyPayload(data, "Paramètres enregistrés");
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
    if (!scheduleId || !payload) return;

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

    await commitChange(data);
  }

  async function handleUpdateSlot(patch: TimetableSlotUpdateInput) {
    if (!scheduleId || !editingSlot) return;
    setIsSavingSlot(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (isDraftSlotId(editingSlot.id)) {
        const response = await fetch("/api/emploi-du-temps/slots/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            scheduleId,
            day: patch.day ?? editingSlot.day,
            afterSlotId: createSlotContext?.afterSlotId ?? null,
            start: patch.start,
            end: patch.end,
            subject: patch.subject,
            subSubject: patch.subSubject,
            customText: patch.customText,
            displayText: patch.displayText,
            color: patch.color,
            gradient: patch.gradient,
            useCustomColor: patch.useCustomColor,
            icon: patch.icon,
            levels: patch.levels,
            notes: patch.notes,
            room: patch.room,
            intervenant: patch.intervenant,
            teacherName: patch.teacherName,
          }),
        });

        const data = (await response.json()) as TimetablePayload & {
          error?: string;
          details?: string;
        };
        if (!response.ok) {
          throw new Error([data.error || "Création impossible.", data.details].filter(Boolean).join(" — "));
        }

        setEditingSlot(null);
        setCreateSlotContext(null);
        await commitChange(data, "Plage créée");
        return;
      }

      const response = await fetch("/api/emploi-du-temps/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      const data = (await response.json()) as TimetablePayload & {
        error?: string;
        details?: string;
        cause?: { message?: string };
      };

      if (!response.ok) {
        const parts = [
          data.error || "Mise à jour impossible.",
          data.details,
          data.cause?.message,
        ].filter(Boolean);
        throw new Error(parts.join(" — "));
      }

      setEditingSlot(null);
      await commitChange(data, "Créneau enregistré");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Mise à jour impossible.");
    } finally {
      setIsSavingSlot(false);
    }
  }

  async function handleSlotAction(actionBody: Record<string, unknown>) {
    if (!scheduleId || !editingSlot) return;
    setIsSavingSlot(true);
    setError(null);

    try {
      const response = await fetch("/api/emploi-du-temps/slots/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          slotId: editingSlot.id,
          ...actionBody,
        }),
      });

      const data = (await response.json()) as TimetablePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Action impossible.");

      if (actionBody.action === "delete") {
        setEditingSlot(null);
      } else if (actionBody.action === "duplicate") {
        const daySlots = data.slots
          .filter((s) => s.day === editingSlot.day)
          .sort((a, b) => a.start.localeCompare(b.start));
        const sourceIndex = daySlots.findIndex((s) => s.id === editingSlot.id);
        const duplicate = sourceIndex >= 0 ? daySlots[sourceIndex + 1] : null;
        if (duplicate) setEditingSlot(duplicate);
      } else if (actionBody.action === "split") {
        const daySlots = data.slots
          .filter((s) => s.day === editingSlot.day)
          .sort((a, b) => a.start.localeCompare(b.start));
        const second = daySlots.find((s) => s.start === actionBody.splitTime);
        if (second) setEditingSlot(second);
      } else {
        const refreshed = data.slots.find((s) => s.id === editingSlot.id) ?? editingSlot;
        setEditingSlot(refreshed);
      }

      await commitChange(data, "Modification appliquée");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.");
    } finally {
      setIsSavingSlot(false);
    }
  }

  function openCreateDrawer(day: string, afterSlotId: string | null) {
    if (!scheduleId || !payload) return;
    setCreateSlotContext({ afterSlotId });
    setEditingSlot(
      buildDraftSlot({
        scheduleId,
        day,
        existingSlots: payload.slots,
        afterSlotId,
        morningStart: settings?.morningStart,
      }),
    );
  }

  function closeSlotDrawer() {
    setEditingSlot(null);
    setCreateSlotContext(null);
  }

  async function handleManualBuilderSave(slots: SmartTimetableSlot[]) {
    if (!scheduleId || !payload) return;
    setIsSavingSlot(true);
    setError(null);

    try {
      const response = await fetch("/api/emploi-du-temps/slots/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          scheduleId,
          slots,
        }),
      });

      const data = (await response.json()) as TimetablePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Sauvegarde impossible.");

      setShowManualBuilder(false);
      setEditingSlot(null);
      setCreateSlotContext(null);
      await commitChange(data, `${slots.length} plage(s) enregistrée(s)`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sauvegarde impossible.");
    } finally {
      setIsSavingSlot(false);
    }
  }

  async function openManualBuilder() {
    if (payload && settings) {
      setShowManualBuilder(true);
      return;
    }

    try {
      const response = await fetch("/api/emploi-du-temps");
      const data = (await response.json()) as TimetablePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Chargement impossible.");
      setPayload(data);
      setSettings(data.schedule.settings);
      setShowManualBuilder(true);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Impossible d'ouvrir la saisie.");
    }
  }

  async function handleRestoreSnapshot(snapshot: TimetablePayload) {
    if (!scheduleId) return;

    const response = await fetch("/api/emploi-du-temps/slots/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "restore",
        scheduleId,
        slots: snapshot.slots,
      }),
    });

    const data = (await response.json()) as TimetablePayload & { error?: string };
    if (!response.ok) {
      setError(data.error || "Restauration impossible.");
      return null;
    }

    return data;
  }

  async function handleUndo() {
    if (!payload) return;
    const previous = commitUndo(payload);
    if (!previous) return;

    const restored = await handleRestoreSnapshot(previous);
    if (restored) {
      setPayload(restored);
      setEditingSlot(null);
      setSuccessMessage("Modification annulée");
    }
  }

  async function handleRedo() {
    if (!payload) return;
    const next = commitRedo(payload);
    if (!next) return;

    const restored = await handleRestoreSnapshot(next);
    if (restored) {
      setPayload(restored);
      setEditingSlot(null);
      setSuccessMessage("Modification rétablie");
    }
  }

  async function handleLock(scope: "session" | "full_day", day: string, slotId?: string) {
    if (!scheduleId || !payload) return;

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

    await commitChange(data);
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

    if (payload) pushSnapshot(payload);
    setPayload(data);
    setSettings(data.schedule.settings);
    setEditingSlot(null);
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
        {payload ? (
          <FloraButton accent="sage" variant="secondary" onClick={() => void openManualBuilder()}>
            Saisir mon emploi du temps
          </FloraButton>
        ) : null}
        <FloraButton
          accent="rose"
          onClick={() => void handleGenerate()}
          disabled={isGenerating || !scheduleId}
        >
          {isGenerating ? "Génération…" : "Générer automatiquement"}
        </FloraButton>
        {payload && settings ? <ExportToolbar payload={payload} settings={settings} /> : null}
        {payload ? (
          <>
            <FloraButton
              accent="cream"
              variant="secondary"
              size="sm"
              disabled={!canUndo}
              onClick={() => void handleUndo()}
            >
              Annuler
            </FloraButton>
            <FloraButton
              accent="cream"
              variant="secondary"
              size="sm"
              disabled={!canRedo}
              onClick={() => void handleRedo()}
            >
              Refaire
            </FloraButton>
          </>
        ) : null}
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

      {successMessage ? (
        <FloraCard padding="md" accent="sage" className="mb-6">
          <p className="text-sm font-light text-flora-text">{successMessage}</p>
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
                  onCreateSlot={(day, afterSlotId) => openCreateDrawer(day, afterSlotId)}
                  onAddDay={(day) => openCreateDrawer(day, null)}
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
            <FloraButton accent="sage" variant="secondary" onClick={() => setShowManualBuilder(true)}>
              Saisir mon emploi du temps
            </FloraButton>
            <FloraButton accent="sage" onClick={() => void handleGenerate()}>
              Créer mon emploi du temps
            </FloraButton>
          </div>
        </FloraCard>
      )}

      {editingSlot && payload ? (
        <TimetableSlotDrawer
          slot={editingSlot}
          allSlots={payload.slots}
          isCreate={isDraftSlotId(editingSlot.id)}
          onClose={closeSlotDrawer}
          onSave={handleUpdateSlot}
          onAction={handleSlotAction}
          isSaving={isSavingSlot}
        />
      ) : null}

      {showManualBuilder && scheduleId && settings ? (
        <TimetableManualBuilder
          scheduleId={scheduleId}
          settings={settings}
          existingSlots={payload?.slots ?? []}
          onClose={() => setShowManualBuilder(false)}
          onSave={handleManualBuilderSave}
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
            resetHistory();
            void loadMeta(data.schedule.id);
          }}
        />
      ) : null}
    </div>
  );
}
