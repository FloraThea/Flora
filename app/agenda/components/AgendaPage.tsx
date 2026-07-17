"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deferEffect } from "@/lib/hooks/defer-effect";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import {
  addDaysToIso,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  todayIso,
} from "@/lib/agenda/date-utils";
import type { AgendaEvent, AgendaFeedPayload, AgendaTask, AgendaView, Hours108Dashboard, MaJourneePayload } from "@/lib/agenda/types";
import { AGENDA_EVENT_TYPES } from "@/lib/agenda/event-types";
import { AgendaNavigation } from "./AgendaNavigation";
import { AgendaDayView } from "./AgendaDayView";
import { AgendaWeekView } from "./AgendaWeekView";
import { AgendaMonthView } from "./AgendaMonthView";
import { AgendaListView } from "./AgendaListView";
import { MaJourneeView } from "./MaJourneeView";
import { Hours108Panel } from "./Hours108Panel";
import { AgendaTasksPanel } from "./AgendaTasksPanel";
import { AgendaReminderToasts } from "./AgendaReminderToasts";
import { AgendaErrorState, AgendaSkeleton, EmptyAgendaState } from "./AgendaStates";

export function AgendaPage() {
  const [view, setView] = useState<AgendaView>("ma_journee");
  const [focusDate, setFocusDate] = useState(todayIso());
  const [feed, setFeed] = useState<AgendaFeedPayload | null>(null);
  const [maJournee, setMaJournee] = useState<MaJourneePayload | null>(null);
  const [hours108, setHours108] = useState<Hours108Dashboard | null>(null);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    eventType: "personnel" as AgendaEvent["eventType"],
    date: todayIso(),
    startTime: "09:00",
    endTime: "10:00",
  });

  const range = useMemo(() => {
    if (view === "month") {
      return {
        start: `${startOfMonth(focusDate)}T00:00:00.000Z`,
        end: `${endOfMonth(focusDate)}T23:59:59.999Z`,
      };
    }
    if (view === "day" || view === "ma_journee") {
      return {
        start: `${focusDate}T00:00:00.000Z`,
        end: `${focusDate}T23:59:59.999Z`,
      };
    }
    return {
      start: `${startOfWeek(focusDate)}T00:00:00.000Z`,
      end: `${endOfWeek(focusDate)}T23:59:59.999Z`,
    };
  }, [focusDate, view]);

  const loadFeed = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(
        `/api/agenda/feed?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`,
      );
      const data = (await response.json()) as AgendaFeedPayload & { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(data.error || data.details || "L'agenda n'a pas pu être chargé.");
      }
      setFeed(data);
      setTasks(data.tasks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur de chargement.");
    }
  }, [range.end, range.start]);

  const loadMaJournee = useCallback(async (date: string) => {
    const response = await fetch(`/api/agenda/ma-journee?date=${encodeURIComponent(date)}`);
    const data = (await response.json()) as MaJourneePayload & { error?: string };
    if (response.ok) setMaJournee(data);
  }, []);

  const load108h = useCallback(async () => {
    const response = await fetch("/api/agenda/108h");
    const data = (await response.json()) as { dashboard?: Hours108Dashboard; error?: string };
    if (response.ok) setHours108(data.dashboard ?? null);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadFeed(), loadMaJournee(focusDate), load108h()]);
    setIsLoading(false);
  }, [focusDate, load108h, loadFeed, loadMaJournee]);

  useEffect(() => {
    deferEffect(() => refreshAll());
  }, [refreshAll]);

  async function handleCreateEvent() {
    if (!newEvent.title.trim()) return;
    const startAt = `${newEvent.date}T${newEvent.startTime}:00.000Z`;
    const endAt = `${newEvent.date}T${newEvent.endTime}:00.000Z`;
    const response = await fetch("/api/agenda/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newEvent.title,
        eventType: newEvent.eventType,
        startAt,
        endAt,
      }),
    });
    if (response.ok) {
      setShowCreateEvent(false);
      setNewEvent((current) => ({ ...current, title: "" }));
      await refreshAll();
    }
  }

  const events = feed?.events ?? [];

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Agenda intelligent"
        subtitle="Votre tableau de bord quotidien : cours, séances, tâches, rappels et suivi des 108 heures."
        meta={feed?.syncedAt ? `Synchronisé ${new Date(feed.syncedAt).toLocaleTimeString("fr-FR")}` : undefined}
        action={
          <FloraButton accent="sage" onClick={() => setShowCreateEvent((current) => !current)}>
            Nouvel événement
          </FloraButton>
        }
      />

      <AgendaNavigation
        view={view}
        focusDate={focusDate}
        onViewChange={(nextView) => {
          setView(nextView);
          if (nextView === "ma_journee") void loadMaJournee(focusDate);
        }}
        onDateChange={(date) => {
          setFocusDate(date);
          if (view === "ma_journee") void loadMaJournee(date);
        }}
      />

      {showCreateEvent ? (
        <FloraCard padding="lg" accent="rose">
          <h3 className="font-serif text-xl font-medium">Créer un événement</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input
              value={newEvent.title}
              onChange={(e) => setNewEvent((c) => ({ ...c, title: e.target.value }))}
              placeholder="Titre"
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            />
            <select
              value={newEvent.eventType}
              onChange={(e) =>
                setNewEvent((c) => ({ ...c, eventType: e.target.value as AgendaEvent["eventType"] }))
              }
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            >
              {AGENDA_EVENT_TYPES.map((type) => (
                <option key={type.type} value={type.type}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent((c) => ({ ...c, date: e.target.value }))}
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            />
            <input
              type="time"
              value={newEvent.startTime}
              onChange={(e) => setNewEvent((c) => ({ ...c, startTime: e.target.value }))}
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            />
            <input
              type="time"
              value={newEvent.endTime}
              onChange={(e) => setNewEvent((c) => ({ ...c, endTime: e.target.value }))}
              className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            />
            <FloraButton onClick={() => void handleCreateEvent()}>Enregistrer</FloraButton>
          </div>
        </FloraCard>
      ) : null}

      {feed?.needsSchoolYearSetup ? (
        <FloraCard padding="md" accent="lavender">
          <p className="text-sm font-light text-flora-text-subtle">
            Complétez votre année scolaire dans le{" "}
            <a href="/profil" className="underline">
              profil pédagogique
            </a>{" "}
            pour affiner l&apos;agenda.
          </p>
        </FloraCard>
      ) : null}

      {isLoading ? <AgendaSkeleton /> : null}

      {!isLoading && error ? (
        <AgendaErrorState message={error} onRetry={() => void refreshAll()} />
      ) : null}

      {!isLoading && !error && view !== "108h" && view !== "tasks" && events.length === 0 ? (
        <EmptyAgendaState />
      ) : null}

      {!isLoading && !error ? (
        <>
          {view === "ma_journee" ? (
            <MaJourneeView payload={maJournee} isLoading={isLoading} />
          ) : null}

          {view === "day" ? <AgendaDayView date={focusDate} events={events} /> : null}
          {view === "week" ? (
            <AgendaWeekView
              focusDate={focusDate}
              events={events}
              onEventMoved={() => void refreshAll()}
            />
          ) : null}
          {view === "month" ? (
            <AgendaMonthView
              focusDate={focusDate}
              events={events}
              onSelectDate={(date) => {
                setFocusDate(date);
                setView("day");
              }}
            />
          ) : null}
          {view === "list" ? <AgendaListView events={events} /> : null}
          {view === "tasks" ? <AgendaTasksPanel tasks={tasks} onRefresh={() => void refreshAll()} /> : null}
          {view === "108h" ? (
            <Hours108Panel
              dashboard={hours108}
              isLoading={isLoading}
              onRefresh={() => void load108h()}
            />
          ) : null}
        </>
      ) : null}

      {!isLoading && !error && view !== "108h" && view !== "tasks" && view !== "ma_journee" && events.length > 0 ? (
        <FloraCard padding="md" accent="cream">
          <p className="text-sm font-light text-flora-text-subtle">
            {events.length} événement(s) sur la période · {tasks.filter((t) => t.status !== "done").length}{" "}
            tâche(s) ouverte(s) · 108h à {hours108?.percentComplete ?? 0} %
          </p>
        </FloraCard>
      ) : null}

      <AgendaReminderToasts initialDue={feed?.dueReminders} />
    </div>
  );
}
