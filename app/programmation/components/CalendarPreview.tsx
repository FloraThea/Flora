"use client";

import { useCallback, useEffect, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import type { AcademicZone, CalendarSnapshot } from "@/lib/programming/types";
import { isOfficialSchoolYear } from "@/lib/programming/vacation-registry";
import { colors } from "@/lib/theme";

type CalendarPreviewProps = {
  schoolYear: string;
  academicZone: AcademicZone;
};

export function CalendarPreview({ schoolYear, academicZone }: CalendarPreviewProps) {
  const [calendar, setCalendar] = useState<CalendarSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/programmation/calendar?schoolYear=${encodeURIComponent(schoolYear)}&zone=${academicZone}`,
      );
      const data = (await response.json()) as { calendar?: CalendarSnapshot; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Impossible de calculer le calendrier.");
      }

      setCalendar(data.calendar ?? null);
    } catch (loadError) {
      setCalendar(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de calculer le calendrier.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [academicZone, schoolYear]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/programmation/calendar?schoolYear=${encodeURIComponent(schoolYear)}&zone=${academicZone}`,
        );
        const data = (await response.json()) as { calendar?: CalendarSnapshot; error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Impossible de calculer le calendrier.");
        }

        if (!cancelled) {
          setCalendar(data.calendar ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCalendar(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de calculer le calendrier.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [academicZone, schoolYear]);

  if (isLoading) {
    return (
      <FloraCard padding="md" accent="sage">
        <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
          Calcul du calendrier scolaire…
        </p>
      </FloraCard>
    );
  }

  if (error || !calendar) {
    return (
      <FloraCard padding="md" accent="peach">
        <p className="text-sm font-light text-[#b88989]">{error ?? "Calendrier indisponible."}</p>
        <button
          type="button"
          onClick={() => void fetchCalendar()}
          className="mt-3 text-sm font-light text-flora-text-muted underline"
        >
          Réessayer
        </button>
      </FloraCard>
    );
  }

  return (
    <FloraCard padding="lg" accent="sage">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="font-serif text-xl text-flora-text">Calendrier scolaire</h3>
        <FloraBadge accent="sage">Zone {calendar.academicZone}</FloraBadge>
        <FloraBadge accent="cream">{calendar.totalClassWeeks} sem. de classe</FloraBadge>
        <FloraBadge accent="lavender">
          {calendar.totalEffectiveWorkingDays} j. effectifs
        </FloraBadge>
      </div>

      <p className="mb-4 text-sm font-light text-flora-text-subtle">
        Rentrée {calendar.rentree} → Fin {calendar.finAnnee} · {calendar.totalPartialWeeks}{" "}
        semaine(s) partielle(s) · Jours travaillés :{" "}
        {calendar.teacherWorkingDays?.join(", ") ?? "Lun–Ven"}
      </p>

      {!isOfficialSchoolYear(schoolYear) ? (
        <p className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs font-light text-[#8a6b38]">
          Cette année scolaire est estimée à partir des dates officielles les plus proches. Choisissez
          une année publiée au Bulletin officiel pour un décompte exact.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        {calendar.periods.map((period) => (
          <div
            key={period.periodNumber}
            className="rounded-2xl border border-white/70 bg-white/55 p-4"
          >
            <p className="font-serif text-lg text-flora-text">{period.label}</p>
            <p className="mt-1 text-2xl font-light text-sauge">
              {period.classWeeks ?? period.workingWeeks}
            </p>
            <p className="text-xs font-light text-flora-text-subtle">semaines de classe</p>
            <p className="mt-1 text-[11px] font-light text-flora-text-subtle">
              {period.effectiveWorkingDays ?? period.workingDays} j. effectifs
            </p>
            <p className="mt-2 text-[11px] font-light text-flora-text-subtle">
              {period.startDate} → {period.endDate}
            </p>
          </div>
        ))}
      </div>
    </FloraCard>
  );
}
