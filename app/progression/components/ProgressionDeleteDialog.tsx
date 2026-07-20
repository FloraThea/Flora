"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { ProgressionDeleteMode, ProgressionDependencies } from "@/lib/progression/types";

type SavedProgressionItem = {
  id: string;
  title: string;
  status: string;
};

type ProgressionDeleteDialogProps = {
  target: SavedProgressionItem;
  dependencies: ProgressionDependencies | null;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (mode: ProgressionDeleteMode) => void;
};

function dependencySummary(dependencies: ProgressionDependencies): string[] {
  const items: string[] = [];

  if (dependencies.programmation) {
    items.push(`Programmation : ${dependencies.programmation.title}`);
  }
  if (dependencies.sequences > 0) {
    items.push(`${dependencies.sequences} séquence${dependencies.sequences > 1 ? "s" : ""}`);
  }
  if (dependencies.seances > 0) {
    items.push(`${dependencies.seances} séance${dependencies.seances > 1 ? "s" : ""}`);
  }
  if (dependencies.journalEntries > 0) {
    items.push(
      `${dependencies.journalEntries} entrée${dependencies.journalEntries > 1 ? "s" : ""} de cahier journal`,
    );
  }
  if (dependencies.agendaEvents > 0) {
    items.push(`${dependencies.agendaEvents} événement${dependencies.agendaEvents > 1 ? "s" : ""} d'agenda`);
  }

  return items;
}

export function ProgressionDeleteDialog({
  target,
  dependencies,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: ProgressionDeleteDialogProps) {
  const isLoading = dependencies === null && !error;
  const hasDependencies = Boolean(dependencies?.hasDependencies);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <FloraCard
        padding="lg"
        accent={hasDependencies ? "peach" : "rose"}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {isLoading ? (
          <>
            <h2 className="font-serif text-2xl font-medium">Supprimer cette progression ?</h2>
            <p className="mt-3 text-sm font-light text-flora-text-muted">Analyse des dépendances…</p>
          </>
        ) : hasDependencies ? (
          <>
            <h2 className="font-serif text-2xl font-medium">Supprimer cette progression ?</h2>
            <p className="mt-3 text-sm font-light text-flora-text-muted">
              Cette progression est utilisée par d&apos;autres éléments de Flora.
            </p>
            <ul className="mt-4 space-y-2 text-sm font-light text-flora-text-muted">
              {dependencySummary(dependencies!).map((item) => (
                <li key={item} className="rounded-xl bg-white/50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm font-light text-flora-text-muted">
              Choisissez comment traiter les éléments liés avant la suppression définitive de{" "}
              <span className="font-medium text-flora-text">{target.title}</span>.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif text-2xl font-medium">Supprimer cette progression ?</h2>
            <p className="mt-3 text-sm font-light text-flora-text-muted">
              Voulez-vous vraiment supprimer cette progression ?
              <br />
              Cette action est définitive.
            </p>
          </>
        )}

        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <FloraButton accent="cream" variant="secondary" onClick={onCancel} disabled={isDeleting}>
            Annuler
          </FloraButton>

          {!isLoading && hasDependencies ? (
            <>
              <FloraButton
                accent="cream"
                variant="outline"
                disabled={isDeleting}
                onClick={() => onConfirm("progression_only")}
              >
                {isDeleting ? "Suppression…" : "Supprimer la progression seule"}
              </FloraButton>
              <FloraButton
                accent="rose"
                disabled={isDeleting}
                onClick={() => onConfirm("with_orphan_links")}
              >
                {isDeleting ? "Suppression…" : "Supprimer aussi les liens inutiles"}
              </FloraButton>
            </>
          ) : !isLoading ? (
            <FloraButton accent="rose" disabled={isDeleting} onClick={() => onConfirm("progression_only")}>
              {isDeleting ? "Suppression…" : "Supprimer définitivement"}
            </FloraButton>
          ) : null}
        </div>
      </FloraCard>
    </div>
  );
}
