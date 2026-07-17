"use client";

import { deferEffect } from "@/lib/hooks/defer-effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { FloraStatCard } from "@/components/ui/FloraStatCard";
import type {
  JournalDaySummary,
  JournalEntry,
  JournalPayload,
  JournalRangePayload,
  JournalViewMode,
  TimetableRefreshPreview,
} from "@/lib/journal/types";
import {
  formatDateLabel,
  getMonthDates,
  getWeekDates,
  todayIso,
  tomorrowIso,
} from "@/lib/journal/date-utils";
import { colors } from "@/lib/theme";
import { JournalDayView } from "./JournalDayView";
import { JournalEntryCompleteModal } from "./JournalEntryCompleteModal";
import { JournalTimetableRefreshDialog } from "./JournalTimetableRefreshDialog";
import { JournalWeekView } from "./JournalWeekView";
import { JournalSubstituteView } from "./JournalSubstituteView";
import { JournalPrintView } from "./JournalPrintView";

const VIEW_OPTIONS: Array<{ id: JournalViewMode; label: string }> = [
  { id: "day", label: "Jour" },
  { id: "week", label: "Semaine" },
  { id: "period", label: "Période" },
  { id: "calendar", label: "Calendrier" },
  { id: "substitute", label: "Remplaçant" },
  { id: "print", label: "Impression" },
];

export function CahierJournalPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [viewMode, setViewMode] = useState<JournalViewMode>("day");
  const [payload, setPayload] = useState<JournalPayload | null>(null);
  const [rangeData, setRangeData] = useState<JournalDaySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryToComplete, setEntryToComplete] = useState<JournalEntry | null>(null);
  const [generatingEntryId, setGeneratingEntryId] = useState<string | null>(null);
  const [refreshPreview, setRefreshPreview] = useState<TimetableRefreshPreview | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const calendarDates = useMemo(() => getMonthDates(selectedDate), [selectedDate]);

  const loadRange = useCallback(async (date: string, mode: JournalViewMode) => {
    if (mode !== "week" && mode !== "period" && mode !== "calendar") {
      setRangeData([]);
      return;
    }

    const rangeParam = mode === "period" ? "period" : "week";
    const response = await fetch(
      `/api/cahier-journal/generate?range=${rangeParam}&date=${encodeURIComponent(date)}`,
    );
    const data = (await response.json()) as JournalRangePayload & { error?: string };
    if (response.ok) {
      setRangeData(data.days ?? []);
    }
  }, []);

  const loadJournal = useCallback(
    async (date: string, regenerate = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = regenerate
          ? await fetch("/api/cahier-journal/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ date, regenerate: true, persist: true }),
            })
          : await fetch(`/api/cahier-journal/generate?date=${encodeURIComponent(date)}`);

        const data = (await response.json()) as JournalPayload & { error?: string };
        if (!response.ok) throw new Error(data.error || "Chargement impossible.");
        setPayload(data);
        await loadRange(date, viewMode);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Erreur de chargement.");
        setPayload(null);
      } finally {
        setIsLoading(false);
      }
    },
    [loadRange, viewMode],
  );

  useEffect(() => {
    deferEffect(() => loadJournal(selectedDate));
  }, [selectedDate, loadJournal]);

  useEffect(() => {
    if (!payload) return;
    deferEffect(() => loadRange(selectedDate, viewMode));
  }, [viewMode, selectedDate, payload, loadRange]);

  const handleCreateManualDay = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/cahier-journal/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_manual", date: selectedDate }),
    });
    const data = (await response.json()) as JournalPayload & { error?: string };
    if (!response.ok) throw new Error(data.error || "Création impossible.");
    setPayload(data);
  }, [selectedDate]);

  const handleGenerateEntry = useCallback(
    async (entry: JournalPayload["entries"][number]) => {
      setGeneratingEntryId(entry.id);
      setError(null);
      try {
        const response = await fetch("/api/cahier-journal/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            date: selectedDate,
            entryRef: {
              entryId: entry.id,
              sortOrder: entry.sortOrder,
              startTime: entry.startTime,
              matiere: entry.matiere,
            },
          }),
        });
        const data = (await response.json()) as JournalPayload & { error?: string };
        if (!response.ok) throw new Error(data.error || "Génération impossible.");
        setPayload(data);
      } catch (generateError) {
        setError(generateError instanceof Error ? generateError.message : "Erreur de génération.");
      } finally {
        setGeneratingEntryId(null);
      }
    },
    [selectedDate],
  );

  const handleRefreshTimetablePreview = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/cahier-journal/refresh-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, apply: false }),
      });
      const data = (await response.json()) as TimetableRefreshPreview & { error?: string };
      if (!response.ok) throw new Error(data.error || "Prévisualisation impossible.");
      setRefreshPreview(data);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Erreur d'actualisation.");
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  const handleRefreshTimetableApply = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/cahier-journal/refresh-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, apply: true }),
      });
      const data = (await response.json()) as TimetableRefreshPreview & { error?: string };
      if (!response.ok) throw new Error(data.error || "Actualisation impossible.");
      setRefreshPreview(null);
      await loadJournal(selectedDate);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Erreur d'actualisation.");
    } finally {
      setIsRefreshing(false);
    }
  }, [loadJournal, selectedDate]);

  const handleRegenerate = useCallback(async () => {
    setIsGenerating(true);
    await loadJournal(selectedDate, true);
    setIsGenerating(false);
  }, [loadJournal, selectedDate]);

  const handleObservationSave = useCallback(
    async (entryId: string, patch: Record<string, unknown>) => {
      const response = await fetch("/api/cahier-journal/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalEntryId: entryId, ...patch }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Observation non enregistrée.");
      }
      await loadJournal(selectedDate);
    },
    [loadJournal, selectedDate],
  );

  const handleProposeAdjustments = useCallback(async () => {
    if (!payload?.journal.id) return;
    const response = await fetch("/api/cahier-journal/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "propose", journalId: payload.journal.id }),
    });
    if (!response.ok) return;
    await loadJournal(selectedDate);
  }, [loadJournal, payload, selectedDate]);

  const handleAdjustmentResponse = useCallback(
    async (adjustmentId: string, status: "accepted" | "rejected") => {
      const response = await fetch("/api/cahier-journal/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "respond", adjustmentId, status }),
      });
      if (!response.ok) return;
      await loadJournal(selectedDate, true);
    },
    [loadJournal, selectedDate],
  );

  const handleExport = useCallback(
    async (
      variant: "teacher" | "substitute",
      format: "html" | "pdf" | "word",
      scope: "day" | "week" | "period",
    ) => {
      const response = await fetch("/api/cahier-journal/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalId: scope === "day" ? payload?.journal.id : undefined,
          date: selectedDate,
          format,
          variant,
          scope,
        }),
      });

      const data = (await response.json()) as {
        content?: string;
        fileName?: string;
        printAsPdf?: boolean;
      };
      if (!response.ok || !data.content) return;

      const blob = new Blob([data.content], {
        type: format === "word" ? "application/msword" : "text/html;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      if (data.printAsPdf) {
        const printWindow = window.open(url, "_blank");
        printWindow?.addEventListener("load", () => printWindow.print());
      } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = data.fileName ?? "cahier-journal.html";
        anchor.click();
      }

      URL.revokeObjectURL(url);
    },
    [payload?.journal.id, selectedDate],
  );

  const dashboard = payload?.journal.dashboard;
  const rangeSummaries =
    viewMode === "calendar"
      ? calendarDates.map((date) => {
          const existing = rangeData.find((day) => day.date === date);
          return (
            existing ?? {
              date,
              journalId: null,
              status: "pending",
              entryCount: 0,
              completedSessions: 0,
              plannedMinutes: 0,
              isHoliday: false,
            }
          );
        })
      : rangeData;

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Cahier journal"
        subtitle="Assemblage automatique à partir de l'emploi du temps, des programmations, séances, rituels et projets."
        meta={payload ? formatDateLabel(payload.journal.journalDate) : undefined}
        action={
          <FloraButton accent="sage" onClick={handleRegenerate} disabled={isGenerating}>
            {isGenerating ? "Assemblage…" : "Régénérer la journée"}
          </FloraButton>
        }
      />

      <FloraCard padding="lg" accent="lavender">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-light" style={{ color: colors.charcoal.subtle }}>
                Date
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-2xl border border-white/70 bg-white/60 px-4 py-2 text-sm"
              />
            </label>
            <FloraButton
              accent="cream"
              variant="secondary"
              onClick={() => setSelectedDate(todayIso())}
            >
              Aujourd&apos;hui
            </FloraButton>
            <FloraButton
              accent="cream"
              variant="secondary"
              onClick={() => setSelectedDate(tomorrowIso())}
            >
              Demain
            </FloraButton>
          </div>

          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <FloraButton
                key={option.id}
                accent={viewMode === option.id ? "sage" : "lavender"}
                variant={viewMode === option.id ? "primary" : "secondary"}
                onClick={() => setViewMode(option.id)}
              >
                {option.label}
              </FloraButton>
            ))}
          </div>
        </div>
      </FloraCard>

      {error ? (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
          {error}
        </p>
      ) : null}

      {dashboard ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <FloraStatCard label="Temps prévu" value={`${dashboard.plannedMinutes} min`} accent="lavender" />
          <FloraStatCard label="Temps réalisé" value={`${dashboard.actualMinutes} min`} accent="sage" />
          <FloraStatCard label="Séances effectuées" value={String(dashboard.completedSessions)} accent="rose" />
          <FloraStatCard label="Séances restantes" value={String(dashboard.remainingSessions)} accent="peach" />
          <FloraStatCard label="Progression période" value={`${dashboard.periodProgressPercent}%`} accent="cream" />
          <FloraStatCard label="Progression annuelle" value={`${dashboard.annualProgressPercent}%`} accent="lavender" />
        </section>
      ) : null}

      {isLoading ? (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Assemblage du cahier journal…
          </p>
        </FloraCard>
      ) : payload ? (
        <>
          <FloraCard padding="lg" accent="sage">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: colors.charcoal.label }}>
                  Classe
                </p>
                <p className="mt-1 text-sm">{payload.journal.className}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: colors.charcoal.label }}>
                  Effectif / Présents
                </p>
                <p className="mt-1 text-sm">
                  {payload.journal.effectif} · {payload.journal.presents} présents
                  {payload.journal.absents.length > 0
                    ? ` · ${payload.journal.absents.join(", ")}`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: colors.charcoal.label }}>
                  Période / Semaine
                </p>
                <p className="mt-1 text-sm">
                  P{payload.journal.periodNumber} · S{payload.journal.weekNumber}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: colors.charcoal.label }}>
                  Projet du jour
                </p>
                <p className="mt-1 text-sm">{payload.journal.dailyProject || "—"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <FloraButton
                accent="lavender"
                variant="secondary"
                onClick={() => void handleRefreshTimetablePreview()}
                disabled={isRefreshing || payload.preview === true}
              >
                {isRefreshing ? "Analyse…" : "Actualiser les horaires depuis l'emploi du temps"}
              </FloraButton>
            </div>
          </FloraCard>

          {viewMode === "day" ? (
            <JournalDayView
              payload={payload}
              onSaveObservation={handleObservationSave}
              onCompleteEntry={setEntryToComplete}
              onGenerateEntry={handleGenerateEntry}
              onCreateManualDay={handleCreateManualDay}
              generatingEntryId={generatingEntryId}
            />
          ) : null}
          {viewMode === "week" || viewMode === "period" || viewMode === "calendar" ? (
            <JournalWeekView
              payload={payload}
              weekDates={weekDates}
              mode={viewMode}
              summaries={rangeSummaries}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setViewMode("day");
              }}
            />
          ) : null}
          {viewMode === "substitute" ? <JournalSubstituteView payload={payload} /> : null}
          {viewMode === "print" ? (
            <JournalPrintView payload={payload} onExport={handleExport} />
          ) : null}

          {payload.adjustments.length > 0 ? (
            <FloraCard padding="lg" accent="peach">
              <h2 className="font-serif text-2xl font-medium">Ajustements proposés par Théa</h2>
              <div className="mt-4 grid gap-3">
                {payload.adjustments.map((adjustment) => (
                  <div key={adjustment.id} className="rounded-2xl bg-white/50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <FloraBadge accent="lavender">{adjustment.adjustmentType}</FloraBadge>
                      <p className="text-sm font-medium">{adjustment.title}</p>
                      <FloraBadge accent={adjustment.status === "accepted" ? "sage" : "cream"}>
                        {adjustment.status}
                      </FloraBadge>
                    </div>
                    <p className="mt-2 text-sm font-light">{adjustment.description}</p>
                    {adjustment.status === "pending" ? (
                      <div className="mt-3 flex gap-2">
                        <FloraButton
                          accent="sage"
                          size="sm"
                          onClick={() => void handleAdjustmentResponse(adjustment.id, "accepted")}
                        >
                          Accepter (report auto)
                        </FloraButton>
                        <FloraButton
                          accent="cream"
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleAdjustmentResponse(adjustment.id, "rejected")}
                        >
                          Refuser
                        </FloraButton>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </FloraCard>
          ) : (
            <div>
              <FloraButton accent="lavender" variant="secondary" onClick={handleProposeAdjustments}>
                Analyser la journée avec Théa
              </FloraButton>
            </div>
          )}
        </>
      ) : null}

      {entryToComplete ? (
        <JournalEntryCompleteModal
          entry={entryToComplete}
          date={selectedDate}
          onClose={() => setEntryToComplete(null)}
          onSaved={async () => {
            await loadJournal(selectedDate);
          }}
        />
      ) : null}

      {refreshPreview ? (
        <JournalTimetableRefreshDialog
          preview={refreshPreview}
          isApplying={isRefreshing}
          onCancel={() => setRefreshPreview(null)}
          onConfirm={() => void handleRefreshTimetableApply()}
        />
      ) : null}
    </div>
  );
}
