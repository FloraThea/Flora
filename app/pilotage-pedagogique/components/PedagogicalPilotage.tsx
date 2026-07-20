"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { cn } from "@/lib/cn";
import type { DocumentChainNode, PilotagePayload } from "@/lib/pedagogical/intelligence/types";
import type { PedagogicalSearchResult } from "@/lib/pedagogical/intelligence/types";
import type { ChangeLogEntry } from "@/lib/pedagogical/types";

type ViewMode = "calendar" | "timeline" | "period";

type PedagogicalPilotageProps = {
  initialPayload: PilotagePayload;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function mapModuleForChain(module: string): "programmation" | "progression" | "sequence" | "seance" {
  if (module === "seances") return "seance";
  if (module === "programmation" || module === "progression" || module === "sequence" || module === "seance") {
    return module;
  }
  return "progression";
}

const WEEKS_PAGE_SIZE = 12;
const IGNORED_SUGGESTIONS_KEY = "flora-ignored-suggestions";

export function PedagogicalPilotage({ initialPayload }: PedagogicalPilotageProps) {
  const [payload, setPayload] = useState(initialPayload);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [periodFilter, setPeriodFilter] = useState<number | null>(null);
  const [weekPage, setWeekPage] = useState(0);
  const [exportMatiere, setExportMatiere] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<PedagogicalSearchResult | null>(null);
  const [searchOffset, setSearchOffset] = useState(0);
  const [documentChain, setDocumentChain] = useState<DocumentChainNode[] | null>(null);
  const [chainTitle, setChainTitle] = useState<string | null>(null);
  const [historyEntry, setHistoryEntry] = useState<ChangeLogEntry | null>(null);
  const [historySnapshot, setHistorySnapshot] = useState<ChangeLogEntry | null>(null);
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(IGNORED_SUGGESTIONS_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredWeeks = useMemo(() => {
    let weeks = payload.weeks;
    if (viewMode === "period" && periodFilter) {
      weeks = weeks.filter((week) => week.periodNumber === periodFilter);
    }
    return weeks;
  }, [payload.weeks, periodFilter, viewMode]);

  const pagedWeeks = useMemo(() => {
    const start = weekPage * WEEKS_PAGE_SIZE;
    return filteredWeeks.slice(start, start + WEEKS_PAGE_SIZE);
  }, [filteredWeeks, weekPage]);

  const visibleSuggestions = useMemo(
    () => payload.suggestions.filter((item) => !ignoredSuggestions.includes(item.id)).slice(0, 10),
    [ignoredSuggestions, payload.suggestions],
  );

  const periods = useMemo(
    () => [...new Set(payload.weeks.map((week) => week.periodNumber))].sort((a, b) => a - b),
    [payload.weeks],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/pedagogical/pilotage");
      const data = (await response.json()) as PilotagePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Actualisation impossible.");
      setPayload(data);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Actualisation impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (offset = 0, append = false) => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/pedagogical/search?q=${encodeURIComponent(searchQuery.trim())}&offset=${offset}&limit=15`,
      );
      const data = (await response.json()) as PedagogicalSearchResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Recherche impossible.");
      setSearchOffset(offset);
      setSearchResult((current) =>
        append && current ? { ...data, hits: [...current.hits, ...data.hits] } : data,
      );
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche impossible.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const loadDocumentChain = useCallback(
    async (input: { module?: string; entityId?: string; competence?: string; title: string }) => {
      setLoading(true);
      setError(null);
      try {
        const params = input.competence
          ? `competence=${encodeURIComponent(input.competence)}`
          : `module=${input.module}&entityId=${input.entityId}`;
        const response = await fetch(`/api/pedagogical/chain?${params}`);
        const data = (await response.json()) as { chain?: DocumentChainNode[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Liens indisponibles.");
        setDocumentChain(data.chain ?? []);
        setChainTitle(input.title);
      } catch (chainError) {
        setError(chainError instanceof Error ? chainError.message : "Liens indisponibles.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadHistorySnapshot = useCallback(async (entry: ChangeLogEntry, anchor: "yesterday" | "last_week" | "last_month") => {
    setHistoryEntry(entry);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/pedagogical/history?entityType=${encodeURIComponent(entry.entityType)}&entityId=${encodeURIComponent(entry.entityId)}&anchor=${anchor}`,
      );
      const data = (await response.json()) as { snapshot?: ChangeLogEntry | null };
      setHistorySnapshot(data.snapshot ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const ignoreSuggestion = useCallback((id: string) => {
    setIgnoredSuggestions((current) => {
      const next = [...new Set([...current, id])];
      localStorage.setItem(IGNORED_SUGGESTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const exportPilotage = useCallback(
    async (format: "pdf" | "word" | "excel") => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/pedagogical/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format,
            scope: exportMatiere === "all" ? "year" : "matiere",
            matiere: exportMatiere === "all" ? undefined : exportMatiere,
          }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error || "Export impossible.");
        }
        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename="([^"]+)"/);
        const fileName = match?.[1] ?? `flora-pilotage.${format === "excel" ? "xlsx" : format === "word" ? "doc" : "html"}`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (exportError) {
        setError(exportError instanceof Error ? exportError.message : "Export impossible.");
      } finally {
        setLoading(false);
      }
    },
    [exportMatiere],
  );

  const totalWeekPages = Math.max(1, Math.ceil(filteredWeeks.length / WEEKS_PAGE_SIZE));

  return (
    <div className="space-y-6">
      <FloraPageTitle
        title="Pilotage pédagogique"
        subtitle={`Année ${payload.schoolYear} · Assistant intelligent Flora · ${payload.coherence.issueCount} alerte(s) · ${payload.coverage.coveragePercent}% couverture BO`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-xl border border-flora-border bg-white px-3 py-2 text-sm"
              value={exportMatiere}
              onChange={(event) => setExportMatiere(event.target.value)}
            >
              <option value="all">Export année</option>
              {payload.matieres.map((matiere) => (
                <option key={matiere} value={matiere}>
                  {matiere}
                </option>
              ))}
            </select>
            <FloraButton variant="secondary" size="sm" onClick={() => void refresh()} disabled={loading}>
              Actualiser
            </FloraButton>
            <FloraButton variant="outline" size="sm" onClick={() => void exportPilotage("excel")} disabled={loading}>
              Excel
            </FloraButton>
            <FloraButton variant="outline" size="sm" onClick={() => void exportPilotage("word")} disabled={loading}>
              Word
            </FloraButton>
            <FloraButton variant="outline" size="sm" onClick={() => void exportPilotage("pdf")} disabled={loading}>
              PDF
            </FloraButton>
          </div>
        }
      />

      {error ? (
        <FloraCard accent="rose" padding="md">
          <p className="text-sm text-flora-text">{error}</p>
        </FloraCard>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <IndicatorCard label="Progression réalisée" value={`${payload.indicators.annualProgressPercent}%`} />
        <IndicatorCard label="Progression prévue" value={`${payload.indicators.plannedProgressPercent}%`} />
        <IndicatorCard label="Compétences couvertes" value={`${payload.indicators.competencesCovered}/${payload.indicators.competencesTotal}`} />
        <IndicatorCard label="Séances" value={String(payload.indicators.seanceCount)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <IndicatorCard label="Temps prévu" value={`${payload.indicators.plannedHoursTotal} h`} />
        <IndicatorCard label="Temps restant" value={`${payload.indicators.remainingHoursTotal} h`} />
        <IndicatorCard label="Programmations" value={String(payload.indicators.programmationCount)} />
        <IndicatorCard label="Progressions" value={String(payload.indicators.progressionCount)} />
      </div>

      <FloraCard padding="lg">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ViewButton active={viewMode === "calendar"} onClick={() => setViewMode("calendar")}>
            Vue calendrier
          </ViewButton>
          <ViewButton active={viewMode === "timeline"} onClick={() => setViewMode("timeline")}>
            Vue chronologique
          </ViewButton>
          <ViewButton active={viewMode === "period"} onClick={() => setViewMode("period")}>
            Vue période
          </ViewButton>
          {viewMode === "period" ? (
            <select
              className="rounded-xl border border-flora-border bg-white px-3 py-2 text-sm"
              value={periodFilter ?? ""}
              onChange={(event) => setPeriodFilter(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Toutes les périodes</option>
              {periods.map((period) => (
                <option key={period} value={period}>
                  Période {period}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div
          className={cn(
            viewMode === "calendar" && "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
            viewMode === "timeline" && "space-y-2",
            viewMode === "period" && "space-y-2",
          )}
        >
          {pagedWeeks.map((week) => (
            <div
              key={`${week.periodNumber}-${week.weekNumberInYear}`}
              className={cn(
                "rounded-2xl border border-flora-border/70 bg-white/70 p-4",
                viewMode === "timeline" && "flex flex-wrap items-start gap-4",
              )}
            >
              <div className="min-w-[120px]">
                <p className="text-sm font-medium text-flora-text">
                  Semaine {week.weekNumberInYear}
                </p>
                <p className="text-xs text-flora-text-muted">
                  P{week.periodNumber} · {formatDate(week.startDate)} → {formatDate(week.endDate)}
                </p>
              </div>
              <div className="flex-1 space-y-1 text-sm text-flora-text">
                <p>
                  <span className="text-flora-text-muted">Matières : </span>
                  {week.subjects.length ? week.subjects.join(", ") : "—"}
                </p>
                <p>
                  <span className="text-flora-text-muted">Compétences : </span>
                  {week.competences.slice(0, 3).join(", ") || "—"}
                  {week.competences.length > 3 ? ` (+${week.competences.length - 3})` : ""}
                </p>
                <p className="text-xs text-flora-text-muted">
                  {week.seanceCount} séance(s) · {week.evaluationCount} éval. · {week.projectCount} projet(s) ·{" "}
                  {week.outingCount} sortie(s)
                </p>
              </div>
            </div>
          ))}
        </div>

        {filteredWeeks.length > WEEKS_PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-flora-text-muted">
              Semaines {weekPage * WEEKS_PAGE_SIZE + 1}–
              {Math.min((weekPage + 1) * WEEKS_PAGE_SIZE, filteredWeeks.length)} sur {filteredWeeks.length}
            </p>
            <div className="flex gap-2">
              <FloraButton size="sm" variant="outline" disabled={weekPage === 0} onClick={() => setWeekPage((page) => page - 1)}>
                Précédent
              </FloraButton>
              <FloraButton
                size="sm"
                variant="outline"
                disabled={weekPage >= totalWeekPages - 1}
                onClick={() => setWeekPage((page) => page + 1)}
              >
                Suivant
              </FloraButton>
            </div>
          </div>
        ) : null}
      </FloraCard>

      {documentChain ? (
        <FloraCard padding="lg" accent="lavender">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl text-flora-text">Liens documentaires · {chainTitle}</h2>
            <FloraButton size="sm" variant="ghost" onClick={() => setDocumentChain(null)}>
              Fermer
            </FloraButton>
          </div>
          <div className="space-y-2">
            {documentChain.map((node, index) => (
              <div key={`${node.module}-${node.entityId}-${index}`} className="flex items-center gap-3">
                {index > 0 ? <span className="text-flora-text-muted">↓</span> : null}
                <Link href={node.href} className="rounded-xl border border-flora-border/60 bg-white/70 px-3 py-2 text-sm hover:bg-white">
                  <span className="text-xs uppercase text-flora-text-muted">{node.module}</span>
                  <span className="ml-2 text-flora-text">{node.title}</span>
                </Link>
              </div>
            ))}
          </div>
        </FloraCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <FloraCard padding="lg" accent="sage">
          <h2 className="mb-3 font-serif text-xl text-flora-text">Cohérence ({payload.coherence.issueCount})</h2>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {payload.coherence.issues.length === 0 ? (
              <p className="text-sm text-flora-text-muted">Aucune incohérence détectée.</p>
            ) : (
              payload.coherence.issues.slice(0, 12).map((issue) => (
                <div key={issue.id} className="rounded-xl border border-flora-border/60 bg-white/60 p-3">
                  <p className="text-sm font-medium text-flora-text">{issue.message}</p>
                  <p className="mt-1 text-xs text-flora-text-muted">{issue.reason}</p>
                  {issue.proposal ? (
                    <p className="mt-2 text-xs text-flora-accent">Proposition : {issue.proposal}</p>
                  ) : null}
                  {issue.entityId ? (
                    <FloraButton
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() =>
                        void loadDocumentChain({
                          module: mapModuleForChain(issue.module),
                          entityId: issue.entityId,
                          title: issue.message,
                        })
                      }
                    >
                      Voir la chaîne
                    </FloraButton>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </FloraCard>

        <FloraCard padding="lg" accent="peach">
          <h2 className="mb-3 font-serif text-xl text-flora-text">
            Couverture BO — {payload.coverage.coveragePercent}%
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <CoverageList title="Absentes" items={payload.coverage.missing.slice(0, 8)} tone="rose" />
            <CoverageList title="Partielles" items={payload.coverage.partial.slice(0, 8)} tone="peach" />
            <CoverageList title="Couvertes" items={payload.coverage.covered.slice(0, 8)} tone="sage" />
            <CoverageList
              title="Vues plusieurs fois"
              items={payload.coverage.duplicate.slice(0, 8).map((item) => ({
                ...item,
                label: `${item.label} (${item.occurrences}×)`,
              }))}
              tone="neutral"
            />
          </div>
        </FloraCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FloraCard padding="lg">
          <h2 className="mb-3 font-serif text-xl text-flora-text">Recherche intelligente</h2>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-flora-border bg-white px-3 py-2 text-sm"
              placeholder="Notion, compétence, objectif, séance…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runSearch();
              }}
            />
            <FloraButton onClick={() => void runSearch(0, false)} disabled={loading}>
              Rechercher
            </FloraButton>
          </div>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {searchResult?.hits.map((hit) => (
              <div
                key={`${hit.module}-${hit.id}`}
                className="rounded-xl border border-flora-border/60 bg-white/60 p-3"
              >
                <Link href={hit.href} className="block transition hover:opacity-80">
                  <p className="text-sm font-medium text-flora-text">{hit.title}</p>
                  <p className="text-xs text-flora-text-muted">{hit.snippet}</p>
                </Link>
                <FloraButton
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() =>
                    void loadDocumentChain({
                      module: mapModuleForChain(hit.module),
                      entityId: hit.id,
                      title: hit.title,
                    })
                  }
                >
                  Chaîne documentaire
                </FloraButton>
              </div>
            )) ?? null}
            {searchResult && searchResult.total === 0 ? (
              <p className="text-sm text-flora-text-muted">Aucun résultat.</p>
            ) : null}
            {searchResult && searchResult.hits.length < searchResult.total ? (
              <FloraButton
                variant="outline"
                size="sm"
                onClick={() => void runSearch(searchOffset + 15, true)}
                disabled={loading}
              >
                Charger plus ({searchResult.total - searchResult.hits.length} restants)
              </FloraButton>
            ) : null}
          </div>
        </FloraCard>

        <FloraCard padding="lg">
          <h2 className="mb-3 font-serif text-xl text-flora-text">Suggestions explicables</h2>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {visibleSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-xl border border-flora-border/60 bg-white/60 p-3">
                <p className="text-xs uppercase tracking-wide text-flora-text-muted">{suggestion.kind.replace("_", " ")}</p>
                <p className="text-sm font-medium text-flora-text">{suggestion.title}</p>
                <p className="mt-1 text-xs text-flora-text-muted">{suggestion.reason}</p>
                <p className="mt-2 text-xs text-flora-text">{suggestion.message}</p>
                {suggestion.competences.length > 0 ? (
                  <p className="mt-2 text-xs text-flora-text-muted">
                    Compétences : {suggestion.competences.join(", ")}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <FloraButton
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      suggestion.competences[0]
                        ? void loadDocumentChain({
                            competence: suggestion.competences[0],
                            title: suggestion.competences[0],
                          })
                        : undefined
                    }
                  >
                    Consulter
                  </FloraButton>
                  <FloraButton size="sm" variant="ghost" onClick={() => ignoreSuggestion(suggestion.id)}>
                    Ignorer
                  </FloraButton>
                </div>
              </div>
            ))}
          </div>
        </FloraCard>
      </div>

      <FloraCard padding="lg">
        <h2 className="mb-3 font-serif text-xl text-flora-text">Historique récent</h2>
        {historyEntry ? (
          <div className="mb-4 rounded-xl border border-flora-border/60 bg-white/60 p-3">
            <p className="text-sm text-flora-text">
              {historyEntry.entityType} · {historyEntry.entityId}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <FloraButton size="sm" variant="outline" onClick={() => void loadHistorySnapshot(historyEntry, "yesterday")}>
                Version d&apos;hier
              </FloraButton>
              <FloraButton size="sm" variant="outline" onClick={() => void loadHistorySnapshot(historyEntry, "last_week")}>
                Semaine dernière
              </FloraButton>
              <FloraButton size="sm" variant="outline" onClick={() => void loadHistorySnapshot(historyEntry, "last_month")}>
                Mois dernier
              </FloraButton>
            </div>
            {historySnapshot ? (
              <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs text-flora-text-muted">
                <p>Snapshot du {new Date(historySnapshot.createdAt).toLocaleString("fr-FR")}</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(historySnapshot.newValue, null, 2)}
                </pre>
              </div>
            ) : (
              <p className="mt-2 text-xs text-flora-text-muted">Aucune version antérieure trouvée pour cette période.</p>
            )}
          </div>
        ) : null}
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {payload.recentHistory.length === 0 ? (
            <p className="text-sm text-flora-text-muted">Aucune modification enregistrée.</p>
          ) : (
            payload.recentHistory.slice(0, 15).map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-flora-border/60 bg-white/60 px-3 py-2"
              >
                <button type="button" className="text-left" onClick={() => setHistoryEntry(entry)}>
                  <p className="text-sm text-flora-text">
                    {entry.module} · {entry.entityType}
                  </p>
                  <p className="text-xs text-flora-text-muted">
                    {new Date(entry.createdAt).toLocaleString("fr-FR")}
                  </p>
                </button>
                <div className="flex gap-2">
                  <FloraButton size="sm" variant="ghost" onClick={() => setHistoryEntry(entry)}>
                    Versions
                  </FloraButton>
                  <FloraButton
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const response = await fetch("/api/pedagogical/history/revert", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ logId: entry.id }),
                      });
                      const data = (await response.json()) as { ok?: boolean; message?: string };
                      if (data.ok) void refresh();
                      else setError(data.message ?? "Restauration impossible.");
                    }}
                  >
                    Restaurer
                  </FloraButton>
                </div>
              </div>
            ))
          )}
        </div>
      </FloraCard>
    </div>
  );
}

function IndicatorCard({ label, value }: { label: string; value: string }) {
  return (
    <FloraCard padding="md">
      <p className="text-xs uppercase tracking-wide text-flora-text-muted">{label}</p>
      <p className="mt-2 font-serif text-2xl text-flora-text">{value}</p>
    </FloraCard>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-2 text-sm transition",
        active ? "bg-flora-accent text-white" : "bg-white/70 text-flora-text hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

function CoverageList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ label: string }>;
  tone: "rose" | "peach" | "sage" | "neutral";
}) {
  const toneClass =
    tone === "rose"
      ? "text-rose-700"
      : tone === "peach"
        ? "text-amber-700"
        : tone === "sage"
          ? "text-emerald-700"
          : "text-flora-text";

  return (
    <div>
      <p className={cn("mb-2 text-sm font-medium", toneClass)}>{title}</p>
      <ul className="space-y-1 text-xs text-flora-text-muted">
        {items.length === 0 ? <li>—</li> : items.map((item) => <li key={item.label}>{item.label}</li>)}
      </ul>
    </div>
  );
}
