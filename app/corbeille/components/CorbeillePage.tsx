"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { TrashConfirmDialog } from "@/components/pedagogical/TrashConfirmDialog";
import { TRASH_RETENTION_DAYS } from "@/lib/trash/types";
import type { TrashEntityType, TrashItem } from "@/lib/trash/types";

const TYPE_LABELS: Record<TrashEntityType, string> = {
  programmation: "Programmation",
  progression: "Progression",
  sequence: "Séquence",
  seance: "Séance",
};

type BulkAction = null | "restore-all" | "empty";

export function CorbeillePage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<TrashEntityType | "all">("all");
  const [matiereFilter, setMatiereFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [restoreConflict, setRestoreConflict] = useState<{
    item: TrashItem;
    parentTitle: string;
  } | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (matiereFilter.trim()) params.set("matiere", matiereFilter.trim());
      const response = await fetch(`/api/corbeille/list?${params.toString()}`);
      const data = (await response.json()) as { items?: TrashItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Chargement impossible.");
      setItems(data.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [matiereFilter, typeFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const matieres = useMemo(
    () => [...new Set(items.map((item) => item.matiere).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [items],
  );

  const handleRestore = useCallback(
    async (item: TrashItem, mode?: "entity_only" | "with_parent") => {
      setBusyId(item.id);
      setError(null);
      try {
        const response = await fetch("/api/corbeille/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: item.entityType, id: item.id, mode }),
        });
        const data = (await response.json()) as { error?: string; requiresChoice?: boolean };
        if (response.status === 409 || data.requiresChoice) {
          setRestoreConflict({ item, parentTitle: item.parentTitle ?? "élément parent" });
          return;
        }
        if (!response.ok) throw new Error(data.error || "Restauration impossible.");
        setRestoreConflict(null);
        await loadItems();
      } catch (restoreError) {
        setError(restoreError instanceof Error ? restoreError.message : "Restauration impossible.");
      } finally {
        setBusyId(null);
      }
    },
    [loadItems],
  );

  const handlePermanentDelete = useCallback(
    async (item: TrashItem) => {
      if (
        !window.confirm(
          "Cette action est définitive. Cet élément et ses données associées ne pourront plus être restaurés.",
        )
      ) {
        return;
      }

      setBusyId(item.id);
      setError(null);
      try {
        const response = await fetch("/api/corbeille/purge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "one", entityType: item.entityType, id: item.id }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error || "Suppression impossible.");
        await loadItems();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
      } finally {
        setBusyId(null);
      }
    },
    [loadItems],
  );

  const handleBulk = useCallback(async () => {
    if (!bulkAction) return;
    setError(null);
    try {
      const response = await fetch("/api/corbeille/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: bulkAction === "restore-all" ? "restore-all" : "empty",
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Action impossible.");
      setBulkAction(null);
      await loadItems();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Action impossible.");
    }
  }, [bulkAction, loadItems]);

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Corbeille"
        subtitle={`Éléments supprimés conservés ${TRASH_RETENTION_DAYS} jours avant purge automatique.`}
      />

      <FloraCard padding="md" accent="cream">
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TrashEntityType | "all")}
          >
            <option value="all">Tous les types</option>
            <option value="programmation">Programmations</option>
            <option value="progression">Progressions</option>
            <option value="sequence">Séquences</option>
            <option value="seance">Séances</option>
          </select>
          <select
            className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            value={matiereFilter}
            onChange={(event) => setMatiereFilter(event.target.value)}
          >
            <option value="">Toutes les matières</option>
            {matieres.map((matiere) => (
              <option key={matiere} value={matiere}>
                {matiere}
              </option>
            ))}
          </select>
          <FloraButton variant="secondary" onClick={() => setBulkAction("restore-all")}>
            Restaurer tout
          </FloraButton>
          <FloraButton variant="ghost" onClick={() => setBulkAction("empty")}>
            Vider la Corbeille
          </FloraButton>
        </div>
      </FloraCard>

      {error ? (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">{error}</p>
      ) : null}

      {isLoading ? (
        <FloraCard padding="lg">
          <p className="text-sm font-light text-flora-text-muted">Chargement…</p>
        </FloraCard>
      ) : items.length === 0 ? (
        <FloraCard padding="lg">
          <p className="text-sm font-light text-flora-text-muted">La Corbeille est vide.</p>
        </FloraCard>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.entityType}-${item.id}`}>
              <FloraCard padding="md" accent="lavender">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FloraBadge accent="cream">{TYPE_LABELS[item.entityType]}</FloraBadge>
                      <FloraBadge accent="sage">{item.status || "—"}</FloraBadge>
                      <span className="text-xs text-flora-text-muted">
                        {item.daysRemaining} jour{item.daysRemaining > 1 ? "s" : ""} restant
                        {item.daysRemaining > 1 ? "s" : ""}
                      </span>
                    </div>
                    <h3 className="mt-2 font-serif text-xl">{item.title}</h3>
                    <p className="mt-1 text-sm font-light text-flora-text-muted">
                      {item.matiere || "Sans matière"}
                      {item.sousMatiere ? ` · ${item.sousMatiere}` : ""}
                      {item.niveau ? ` · ${item.niveau}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-flora-text-subtle">
                      Supprimé le {new Date(item.deletedAt).toLocaleDateString("fr-FR")} · purge prévue le{" "}
                      {new Date(item.purgeAfter).toLocaleDateString("fr-FR")}
                    </p>
                    {item.dependencySummary.length > 0 ? (
                      <p className="mt-2 text-xs text-flora-text-muted">
                        {item.dependencySummary.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <FloraButton
                      size="sm"
                      variant="secondary"
                      disabled={busyId === item.id}
                      onClick={() => void handleRestore(item)}
                    >
                      Restaurer
                    </FloraButton>
                    <FloraButton
                      size="sm"
                      accent="rose"
                      disabled={busyId === item.id}
                      onClick={() => void handlePermanentDelete(item)}
                    >
                      Supprimer définitivement
                    </FloraButton>
                  </div>
                </div>
              </FloraCard>
            </li>
          ))}
        </ul>
      )}

      {restoreConflict ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <FloraCard padding="lg" accent="peach" className="w-full max-w-lg">
            <h2 className="font-serif text-2xl font-medium">Restaurer avec le parent ?</h2>
            <p className="mt-3 text-sm font-light text-flora-text-muted">
              Le parent « {restoreConflict.parentTitle} » est encore dans la Corbeille.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <FloraButton variant="secondary" onClick={() => setRestoreConflict(null)}>
                Annuler
              </FloraButton>
              <FloraButton
                variant="outline"
                onClick={() =>
                  void handleRestore(restoreConflict.item, "entity_only").finally(() =>
                    setRestoreConflict(null),
                  )
                }
              >
                Restaurer seul
              </FloraButton>
              <FloraButton
                onClick={() =>
                  void handleRestore(restoreConflict.item, "with_parent").finally(() =>
                    setRestoreConflict(null),
                  )
                }
              >
                Restaurer avec le parent
              </FloraButton>
            </div>
          </FloraCard>
        </div>
      ) : null}

      {bulkAction ? (
        <TrashConfirmDialog
          title={bulkAction === "restore-all" ? "Restaurer tout ?" : "Vider la Corbeille ?"}
          description={
            bulkAction === "restore-all"
              ? "Tous les éléments de la Corbeille seront restaurés."
              : "Cette action supprimera définitivement tous les éléments de la Corbeille."
          }
          confirmLabel={bulkAction === "restore-all" ? "Restaurer tout" : "Vider la Corbeille"}
          onCancel={() => setBulkAction(null)}
          onConfirm={() => void handleBulk()}
        />
      ) : null}
    </div>
  );
}
