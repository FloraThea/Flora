"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  LibraryResourceOption,
  ReferentielOption,
  ReferentielOptionsPayload,
} from "@/lib/pedagogical/preparation/types";

export function useReferentielOptions(input: {
  matiere: string;
  niveau: string;
  sousMatiere: string;
}) {
  const [domaines, setDomaines] = useState<string[]>([]);
  const [competences, setCompetences] = useState<ReferentielOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!input.matiere.trim()) {
      setDomaines([]);
      setCompetences([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        matiere: input.matiere.trim(),
        niveau: input.niveau.trim(),
        sousMatiere: input.sousMatiere.trim(),
      });
      const response = await fetch(`/api/referentiel/options?${params.toString()}`);
      const data = (await response.json()) as ReferentielOptionsPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Référentiel indisponible.");
      setDomaines(data.domaines ?? []);
      setCompetences(data.competences ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Référentiel indisponible.");
      setDomaines([]);
      setCompetences([]);
    } finally {
      setLoading(false);
    }
  }, [input.matiere, input.niveau, input.sousMatiere]);

  useEffect(() => {
    void load();
  }, [load]);

  return { domaines, competences, loading, error, reload: load };
}

export function useLibraryResources(matiere: string) {
  const [resources, setResources] = useState<LibraryResourceOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matiere.trim()) {
      setResources([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/bibliotheque/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ discipline: matiere, sort: "title" }),
        });
        const data = (await response.json()) as {
          items?: Array<{
            id: string;
            title: string;
            discipline?: string;
            category?: string;
            format?: string;
          }>;
        };
        if (cancelled) return;
        setResources(
          (data.items ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            discipline: item.discipline ?? "",
            category: item.category ?? "",
            format: item.format ?? "",
          })),
        );
      } catch {
        if (!cancelled) setResources([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [matiere]);

  return { resources, loading };
}

export function toggleListValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function toggleIdValue(values: string[], id: string): string[] {
  return toggleListValue(values, id);
}
