"use client";

import Link from "next/link";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraProgressBar } from "@/components/ui/FloraProgressBar";
import { formatMinutesAsHours } from "@/lib/agenda/hours-108";
import type { MaJourneePayload } from "@/lib/agenda/types";
import { AgendaEventCard } from "./AgendaEventCard";

type MaJourneeViewProps = {
  payload: MaJourneePayload | null;
  isLoading: boolean;
};

export function MaJourneeView({ payload, isLoading }: MaJourneeViewProps) {
  if (isLoading) {
    return (
      <FloraCard padding="lg">
        <p className="text-sm font-light text-flora-text-subtle">Chargement de votre journée…</p>
      </FloraCard>
    );
  }

  if (!payload) {
    return (
      <FloraCard padding="lg">
        <p className="text-sm font-light text-flora-text-subtle">Impossible de charger la journée.</p>
      </FloraCard>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="flex flex-col gap-6 xl:col-span-2">
        <FloraCard padding="lg" accent="sage">
          <h2 className="font-serif text-2xl font-medium capitalize">{payload.dateLabel}</h2>
          <p className="mt-2 text-sm font-light text-flora-text-subtle">
            Votre tableau de bord quotidien — emploi du temps, séances et priorités.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <section>
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-flora-text-subtle">
                Emploi du temps
              </h3>
              <div className="mt-3 space-y-2">
                {payload.timetableSlots.length === 0 ? (
                  <p className="text-sm font-light text-flora-text-subtle">Aucun créneau planifié.</p>
                ) : (
                  payload.timetableSlots.map((slot) => (
                    <div
                      key={`${slot.start}-${slot.subject}`}
                      className="rounded-2xl bg-white/45 px-3 py-2 text-sm"
                    >
                      <span className="text-flora-text-subtle">
                        {slot.start}–{slot.end}
                      </span>{" "}
                      {slot.subject}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium uppercase tracking-[0.12em] text-flora-text-subtle">
                Séances du jour
              </h3>
              <div className="mt-3 space-y-2">
                {payload.seances.length === 0 ? (
                  <p className="text-sm font-light text-flora-text-subtle">Aucune séance datée.</p>
                ) : (
                  payload.seances.map((seance) => (
                    <Link
                      key={seance.id}
                      href="/seances"
                      className="block rounded-2xl bg-white/45 px-3 py-2 text-sm hover:bg-white/70"
                    >
                      <p className="font-medium">{seance.title}</p>
                      <p className="text-flora-text-subtle">
                        {seance.matiere} · {seance.dureeMinutes} min
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </FloraCard>

        <FloraCard padding="lg" accent="lavender">
          <h3 className="font-serif text-xl font-medium">Événements & rendez-vous</h3>
          <div className="mt-4 grid gap-2">
            {payload.events.length === 0 ? (
              <p className="text-sm font-light text-flora-text-subtle">Aucun événement aujourd&apos;hui.</p>
            ) : (
              payload.events.map((event) => <AgendaEventCard key={event.id} event={event} />)
            )}
          </div>
        </FloraCard>
      </div>

      <div className="flex flex-col gap-6">
        <FloraCard padding="lg" accent="rose">
          <h3 className="font-serif text-xl font-medium">Priorités</h3>
          <ul className="mt-4 space-y-2">
            {payload.priorities.length === 0 ? (
              <li className="text-sm font-light text-flora-text-subtle">Journée calme.</li>
            ) : (
              payload.priorities.map((item) => (
                <li key={item} className="rounded-2xl bg-white/45 px-3 py-2 text-sm">
                  {item}
                </li>
              ))
            )}
          </ul>
        </FloraCard>

        <FloraCard padding="lg" accent="peach">
          <h3 className="font-serif text-xl font-medium">Tâches</h3>
          <div className="mt-4 space-y-2">
            {payload.tasks.slice(0, 6).map((task) => (
              <div key={task.id} className="rounded-2xl bg-white/45 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{task.title}</span>
                  <FloraBadge accent="cream" size="sm">
                    {task.status === "todo"
                      ? "À faire"
                      : task.status === "in_progress"
                        ? "En cours"
                        : "Terminée"}
                  </FloraBadge>
                </div>
              </div>
            ))}
          </div>
        </FloraCard>

        <FloraCard padding="lg" accent="cream">
          <h3 className="font-serif text-xl font-medium">108h ({payload.hours108.workQuotaLabel})</h3>
          <p className="mt-2 text-sm font-light text-flora-text-subtle">
            {formatMinutesAsHours(payload.hours108.totalCompletedMinutes)} réalisées sur{" "}
            {formatMinutesAsHours(payload.hours108.totalPlannedMinutes)}
          </p>
          <FloraProgressBar
            className="mt-4"
            value={payload.hours108.percentComplete}
            accent="sage"
            showLabel
          />
        </FloraCard>

        {payload.reminders.length > 0 ? (
          <FloraCard padding="lg" accent="lavender">
            <h3 className="font-serif text-xl font-medium">Rappels</h3>
            <ul className="mt-4 space-y-2 text-sm font-light text-flora-text-muted">
              {payload.reminders.map((reminder) => (
                <li key={reminder.id}>{reminder.message}</li>
              ))}
            </ul>
          </FloraCard>
        ) : null}
      </div>
    </div>
  );
}
