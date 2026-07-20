import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { isMissingSchemaColumnError } from "@/lib/supabase/schema-compat";
import { onlyActive } from "@/lib/trash/active-query";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import type { PedagogicalModule } from "../types";
import type { PedagogicalSearchHit, PedagogicalSearchResult } from "./types";

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function scoreText(text: string, query: string): number {
  const normalized = normalizeQuery(text);
  if (!normalized || !query) return 0;
  if (normalized === query) return 100;
  if (normalized.includes(query)) return 70;
  const tokens = query.split(/\s+/).filter(Boolean);
  const matched = tokens.filter((token) => normalized.includes(token)).length;
  return matched > 0 ? matched * 20 : 0;
}

function snippet(text: string, query: string, max = 140): string {
  const normalized = normalizeQuery(text);
  const index = normalized.indexOf(query);
  if (index < 0) return text.slice(0, max);
  const start = Math.max(0, index - 30);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + max)}${text.length > start + max ? "…" : ""}`;
}

type SearchableRow = {
  id: string;
  title: string;
  matiere?: string;
  extra?: string;
  href: string;
  module: PedagogicalModule;
};

type ProgressionSearchRow = {
  id: string;
  title: string;
  matiere?: string | null;
  objectif?: string | null;
};

async function loadProgressionsForSearch(
  profileId: string,
): Promise<{ data: ProgressionSearchRow[] | null; error: Error | null }> {
  const db = await floraDb();
  const withObjectif = await onlyActive(
    db.from("progressions").select("id, title, matiere, objectif").eq("teacher_profile_id", profileId).limit(300),
  );

  if (!withObjectif.error) {
    return { data: (withObjectif.data ?? []) as ProgressionSearchRow[], error: null };
  }

  if (isMissingSchemaColumnError(withObjectif.error, "objectif")) {
    const fallback = await onlyActive(
      db.from("progressions").select("id, title, matiere").eq("teacher_profile_id", profileId).limit(300),
    );
    if (fallback.error) {
      return { data: null, error: new Error(fallback.error.message) };
    }
    return { data: (fallback.data ?? []) as ProgressionSearchRow[], error: null };
  }

  return { data: null, error: new Error(withObjectif.error.message) };
}

export async function searchPedagogicalDocuments(input: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<PedagogicalSearchResult> {
  const scope = await requireTeacherScope();
  const query = normalizeQuery(input.query);
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const offset = Math.max(input.offset ?? 0, 0);

  if (!query) {
    return { query: input.query, total: 0, hits: [], limit, offset };
  }

  const rows: SearchableRow[] = [];
  const db = await floraDb();

  const [programmations, progressions, sequences, seances] = await Promise.all([
    onlyActive(
      db.from("programmations").select("id, title, matiere").eq("teacher_profile_id", scope.profileId).limit(200),
    ),
    loadProgressionsForSearch(scope.profileId),
    onlyActive(
      db.from("sequences").select("id, title, matiere, competence_bo").eq("teacher_profile_id", scope.profileId).limit(500),
    ),
    onlyActive(
      db.from("seances").select("id, title, matiere, objectif, methode, competence_bo").eq("teacher_profile_id", scope.profileId).limit(1000),
    ),
  ]);

  if (progressions.error) throw progressions.error;

  for (const row of programmations.data ?? []) {
    rows.push({
      id: String(row.id),
      title: String(row.title),
      matiere: String(row.matiere ?? ""),
      extra: "",
      href: `/programmation?id=${row.id}`,
      module: "programmation",
    });
  }

  for (const row of progressions.data ?? []) {
    rows.push({
      id: String(row.id),
      title: String(row.title),
      matiere: String(row.matiere ?? ""),
      extra: String(row.objectif ?? ""),
      href: `/progression?id=${row.id}`,
      module: "progression",
    });
  }

  for (const row of sequences.data ?? []) {
    rows.push({
      id: String(row.id),
      title: String(row.title),
      matiere: String(row.matiere ?? ""),
      extra: String(row.competence_bo ?? ""),
      href: `/sequences?id=${row.id}`,
      module: "sequence",
    });
  }

  for (const row of seances.data ?? []) {
    rows.push({
      id: String(row.id),
      title: String(row.title),
      matiere: String(row.matiere ?? ""),
      extra: [row.objectif, row.methode, row.competence_bo].map(String).join(" "),
      href: `/seances?id=${row.id}`,
      module: "seances",
    });
  }

  const { data: progressionRows } = await (await floraDb())
    .from("progression_rows")
    .select("id, competence_bo, sequence_module, progression_id")
    .limit(2000);

  const ownedProgressionIds = new Set((progressions.data ?? []).map((row) => String(row.id)));
  for (const row of progressionRows ?? []) {
    if (!ownedProgressionIds.has(String(row.progression_id))) continue;
    const label = [row.competence_bo, row.sequence_module].map(String).join(" ").trim();
    if (!label) continue;
    rows.push({
      id: String(row.id),
      title: label,
      href: `/progression?id=${row.progression_id}`,
      module: "progression",
      extra: label,
    });
  }

  const hits: PedagogicalSearchHit[] = rows
    .map((row) => {
      const score = Math.max(
        scoreText(row.title, query),
        scoreText(row.extra ?? "", query),
        scoreText(row.matiere ?? "", query),
      );
      return {
        id: row.id,
        module: row.module,
        title: row.title,
        snippet: snippet(`${row.title} ${row.extra ?? ""}`.trim(), query),
        matiere: row.matiere,
        href: row.href,
        score,
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    query: input.query,
    total: hits.length,
    hits: hits.slice(offset, offset + limit),
    limit,
    offset,
  };
}
