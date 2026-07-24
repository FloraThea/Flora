"use client";

import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import { accentClasses } from "@/lib/theme";
import {
  getModuleSummariesForTable,
  summarizeModulesByPeriod,
} from "@/lib/programming/module-summaries";
import type { ProgrammationModuleSummary, ProgrammingTable } from "@/lib/programming/types";

type ProgrammationSynthesisViewProps = {
  table: ProgrammingTable;
  programmationMetadata?: Record<string, unknown>;
};

function ModuleSummaryCard({
  summary,
  accentClass,
}: {
  summary: ProgrammationModuleSummary;
  accentClass: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/70 bg-white/65 p-4 ${accentClass}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="font-medium text-flora-text">{summary.label}</p>
        <FloraBadge accent="cream">
          {summary.sessionCount} séance{summary.sessionCount > 1 ? "s" : ""}
        </FloraBadge>
      </div>

      {summary.startWeek ? (
        <p className="text-xs font-light text-flora-text-subtle">
          Semaine de début : S{summary.startWeek}
        </p>
      ) : null}

      {summary.objectifs.length > 0 ? (
        <p className="mt-2 text-sm font-light text-flora-text-muted">
          {summary.objectifs[0]}
        </p>
      ) : null}

      {summary.competences.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {summary.competences.slice(0, 3).map((competence) => (
            <li key={competence} className="text-xs font-light text-flora-text-muted">
              • {competence}
            </li>
          ))}
        </ul>
      ) : null}

      {summary.sourcePath ? (
        <p className="mt-3 text-[11px] font-light text-flora-text-subtle">
          Source : {summary.sourcePath}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Vue synthétique annuelle : modules / séquences sans le détail séance par séance.
 */
export function ProgrammationSynthesisView({
  table,
  programmationMetadata,
}: ProgrammationSynthesisViewProps) {
  const summaries = getModuleSummariesForTable(table, programmationMetadata);
  const byPeriod = summarizeModulesByPeriod(summaries);
  const accent = accentClasses[table.accent] ?? accentClasses.lavender;
  const title = table.subSubjectLabel || table.subjectLabel;

  if (summaries.length === 0) {
    return null;
  }

  return (
    <FloraCard padding="lg" className={accent.border} id={`prog-synthesis-${table.subjectKey}`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h3 className="font-serif text-2xl text-flora-text">{title}</h3>
        <FloraBadge accent={table.accent}>{table.subjectLabel}</FloraBadge>
        <FloraBadge accent="sage">{summaries.length} modules</FloraBadge>
      </div>

      <p className="mb-6 text-sm font-light text-flora-text-muted">
        Vue annuelle synthétique — le détail des séances se trouve dans la progression.
      </p>

      <div className="flex flex-col gap-8">
        {table.periods.map((period) => {
          const periodModules = byPeriod.get(period.periodNumber) ?? [];
          if (periodModules.length === 0) return null;

          return (
            <section key={period.periodNumber}>
              <div
                className={`mb-4 rounded-2xl px-4 py-3 text-center ${accent.bgMuted}`}
              >
                <p className="font-serif text-lg text-flora-text">{period.label}</p>
                <p className="text-sm font-light text-flora-text-subtle">
                  {period.weekCount} semaine{period.weekCount > 1 ? "s" : ""} ·{" "}
                  {periodModules.length} module{periodModules.length > 1 ? "s" : ""}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {periodModules.map((summary) => (
                  <ModuleSummaryCard
                    key={summary.id}
                    summary={summary}
                    accentClass={accent.border}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </FloraCard>
  );
}
