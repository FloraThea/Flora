import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { getStorageBucketName } from "@/lib/supabase/storage-config";
import { deleteProgression } from "@/lib/progression/progression-service";
import { normalizeMatiere, normalizeSousMatiere } from "@/lib/pedagogical/subjects";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { onlyActive, onlyTrashed } from "./active-query";
import type {
  SimilarDocument,
  TrashEntityType,
  TrashItem,
  TrashListFilter,
  TrashRestoreMode,
} from "./types";
import { TRASH_RETENTION_DAYS } from "./types";

export { TRASH_RETENTION_DAYS };

type EntityConfig = {
  table: string;
  titleField: string;
  matiereFields: { matiere: string; sousMatiere: string; niveau: string; periode: string };
  parent?: {
    field: string;
    type: TrashEntityType;
    table: string;
    titleField: string;
  };
};

const ENTITY_CONFIG: Record<TrashEntityType, EntityConfig> = {
  programmation: {
    table: "programmations",
    titleField: "title",
    matiereFields: {
      matiere: "matiere",
      sousMatiere: "sous_matiere",
      niveau: "levels",
      periode: "periode",
    },
  },
  progression: {
    table: "progressions",
    titleField: "title",
    matiereFields: {
      matiere: "matiere",
      sousMatiere: "sous_matiere",
      niveau: "niveau",
      periode: "periode",
    },
    parent: {
      field: "programmation_id",
      type: "programmation",
      table: "programmations",
      titleField: "title",
    },
  },
  sequence: {
    table: "sequences",
    titleField: "title",
    matiereFields: {
      matiere: "matiere",
      sousMatiere: "sous_matiere",
      niveau: "niveau",
      periode: "period_number",
    },
    parent: {
      field: "progression_id",
      type: "progression",
      table: "progressions",
      titleField: "title",
    },
  },
  seance: {
    table: "seances",
    titleField: "title",
    matiereFields: {
      matiere: "matiere",
      sousMatiere: "sous_matiere",
      niveau: "niveau",
      periode: "period_number",
    },
    parent: {
      field: "sequence_id",
      type: "sequence",
      table: "sequences",
      titleField: "title",
    },
  },
};

function computePurgeAfter(deletedAt: Date): string {
  const purge = new Date(deletedAt);
  purge.setDate(purge.getDate() + TRASH_RETENTION_DAYS);
  return purge.toISOString();
}

function daysRemaining(purgeAfter: string): number {
  const ms = new Date(purgeAfter).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function mapRowToTrashItem(
  entityType: TrashEntityType,
  row: Record<string, unknown>,
  extras?: Partial<TrashItem>,
): TrashItem {
  const config = ENTITY_CONFIG[entityType];
  const deletedAt = String(row.deleted_at ?? new Date().toISOString());
  const purgeAfter = String(row.purge_after ?? computePurgeAfter(new Date(deletedAt)));

  let niveau = "";
  const niveauRaw = row[config.matiereFields.niveau];
  if (Array.isArray(niveauRaw)) {
    niveau = niveauRaw.join(", ");
  } else if (niveauRaw != null && niveauRaw !== "") {
    niveau = String(niveauRaw);
  }

  let periode = "";
  const periodeRaw = row[config.matiereFields.periode];
  if (periodeRaw != null && periodeRaw !== "") {
    periode = String(periodeRaw);
  }

  return {
    id: String(row.id),
    entityType,
    title: String(row[config.titleField] ?? ""),
    matiere: normalizeMatiere(String(row[config.matiereFields.matiere] ?? "")),
    sousMatiere: normalizeSousMatiere(
      String(row[config.matiereFields.sousMatiere] ?? ""),
      String(row[config.matiereFields.matiere] ?? ""),
    ),
    niveau,
    periode,
    status: String(row.status ?? ""),
    deletedAt,
    purgeAfter,
    daysRemaining: daysRemaining(purgeAfter),
    dependencySummary: extras?.dependencySummary ?? [],
    parentId: extras?.parentId ?? null,
    parentType: extras?.parentType ?? null,
    parentTitle: extras?.parentTitle ?? null,
    parentInTrash: extras?.parentInTrash ?? false,
  };
}

async function loadEntityRow(entityType: TrashEntityType, id: string) {
  const scope = await requireTeacherScope();
  const config = ENTITY_CONFIG[entityType];

  const { data, error } = await (await floraDb())
    .from(config.table)
    .select("*")
    .eq("id", id)
    .eq("teacher_profile_id", scope.profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Élément introuvable.");

  return { scope, row: data as Record<string, unknown> };
}

async function resolveParentTrashState(
  entityType: TrashEntityType,
  row: Record<string, unknown>,
): Promise<Pick<TrashItem, "parentId" | "parentType" | "parentTitle" | "parentInTrash">> {
  const parentConfig = ENTITY_CONFIG[entityType].parent;
  if (!parentConfig) {
    return {
      parentId: null,
      parentType: null,
      parentTitle: null,
      parentInTrash: false,
    };
  }

  const parentId = row[parentConfig.field];
  if (!parentId) {
    return {
      parentId: null,
      parentType: null,
      parentTitle: null,
      parentInTrash: false,
    };
  }

  const { data: parent } = await (await floraDb())
    .from(parentConfig.table)
    .select("id, title, deleted_at")
    .eq("id", parentId)
    .maybeSingle();

  if (!parent) {
    return {
      parentId: String(parentId),
      parentType: parentConfig.type,
      parentTitle: null,
      parentInTrash: false,
    };
  }

  const parentRecord = parent as Record<string, unknown>;

  return {
    parentId: String(parentRecord.id),
    parentType: parentConfig.type,
    parentTitle: String(parentRecord[parentConfig.titleField] ?? parentRecord.title ?? ""),
    parentInTrash: Boolean(parentRecord.deleted_at),
  };
}

async function buildDependencySummary(
  entityType: TrashEntityType,
  id: string,
): Promise<string[]> {
  const db = await floraDb();
  const summary: string[] = [];

  if (entityType === "programmation") {
    const { count } = await onlyActive(db.from("progressions").select("*", { count: "exact", head: true }))
      .eq("programmation_id", id);
    if ((count ?? 0) > 0) summary.push(`${count} progression(s) liée(s)`);
  }

  if (entityType === "progression") {
    const { count: seqCount } = await onlyActive(
      db.from("sequences").select("*", { count: "exact", head: true }),
    ).eq("progression_id", id);
    if ((seqCount ?? 0) > 0) summary.push(`${seqCount} séquence(s) liée(s)`);
  }

  if (entityType === "sequence") {
    const { count } = await onlyActive(db.from("seances").select("*", { count: "exact", head: true })).eq(
      "sequence_id",
      id,
    );
    if ((count ?? 0) > 0) summary.push(`${count} séance(s) liée(s)`);
  }

  return summary;
}

export async function moveToTrash(input: {
  entityType: TrashEntityType;
  id: string;
  reason?: string;
}): Promise<void> {
  const { scope, row } = await loadEntityRow(input.entityType, input.id);

  if (row.deleted_at) {
    throw new Error("Cet élément est déjà dans la Corbeille.");
  }

  const deletedAt = new Date().toISOString();
  const config = ENTITY_CONFIG[input.entityType];

  const { error } = await (await floraDb())
    .from(config.table)
    .update({
      deleted_at: deletedAt,
      deleted_by: scope.profileId,
      deletion_reason: input.reason ?? null,
      purge_after: computePurgeAfter(new Date(deletedAt)),
      updated_at: deletedAt,
    })
    .eq("id", input.id)
    .eq("teacher_profile_id", scope.profileId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de placer l'élément dans la Corbeille."));
  }
}

export async function restoreFromTrash(input: {
  entityType: TrashEntityType;
  id: string;
  mode?: TrashRestoreMode;
}): Promise<{ restoredParentId?: string }> {
  const { scope, row } = await loadEntityRow(input.entityType, input.id);

  if (!row.deleted_at) {
    throw new Error("Cet élément n'est pas dans la Corbeille.");
  }

  const parentState = await resolveParentTrashState(input.entityType, row);

  if (parentState.parentInTrash && parentState.parentId && input.mode !== "entity_only") {
    if (input.mode === "with_parent" && parentState.parentType) {
      await restoreFromTrash({
        entityType: parentState.parentType,
        id: parentState.parentId,
        mode: "with_parent",
      });
    } else if (!input.mode) {
      throw new Error(
        `Le parent « ${parentState.parentTitle ?? parentState.parentId} » est encore dans la Corbeille.`,
      );
    }
  }

  const config = ENTITY_CONFIG[input.entityType];
  const { error } = await (await floraDb())
    .from(config.table)
    .update({
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      purge_after: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("teacher_profile_id", scope.profileId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de restaurer l'élément."));
  }

  return parentState.parentId ? { restoredParentId: parentState.parentId } : {};
}

async function permanentDeleteProgrammation(id: string): Promise<void> {
  const db = await floraDb();
  const { data: programmation } = await db.from("programmations").select("*").eq("id", id).maybeSingle();
  if (!programmation) return;

  await db
    .from("progressions")
    .update({ programmation_id: null, link_mode: "independent", updated_at: new Date().toISOString() })
    .eq("programmation_id", id);

  const storagePath = String(programmation.source_storage_path ?? "").trim();
  if (storagePath) {
    await db.storage.from(getStorageBucketName()).remove([storagePath]).catch(() => undefined);
  }

  const { error } = await db.from("programmations").delete().eq("id", id);
  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Suppression définitive impossible."));
  }
}

async function permanentDeleteSequence(id: string): Promise<void> {
  const db = await floraDb();

  const { count } = await onlyActive(db.from("seances").select("*", { count: "exact", head: true })).eq(
    "sequence_id",
    id,
  );
  if ((count ?? 0) > 0) {
    throw new Error("Cette séquence est encore utilisée par des séances actives.");
  }

  const { error } = await db.from("sequences").delete().eq("id", id);
  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Suppression définitive impossible."));
  }
}

async function permanentDeleteSeance(id: string): Promise<void> {
  const { error } = await (await floraDb()).from("seances").delete().eq("id", id);
  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Suppression définitive impossible."));
  }
}

export async function permanentDeleteFromTrash(input: {
  entityType: TrashEntityType;
  id: string;
}): Promise<void> {
  const { row } = await loadEntityRow(input.entityType, input.id);

  if (!row.deleted_at) {
    throw new Error("Seuls les éléments de la Corbeille peuvent être supprimés définitivement.");
  }

  switch (input.entityType) {
    case "programmation":
      await permanentDeleteProgrammation(input.id);
      return;
    case "progression":
      await deleteProgression(input.id, "progression_only");
      return;
    case "sequence":
      await permanentDeleteSequence(input.id);
      return;
    case "seance":
      await permanentDeleteSeance(input.id);
      return;
    default:
      throw new Error("Type d'élément non pris en charge.");
  }
}

export async function listTrashItems(filter: TrashListFilter = {}): Promise<TrashItem[]> {
  const scope = await requireTeacherScope();
  const db = await floraDb();
  const types =
    filter.entityType && filter.entityType !== "all"
      ? [filter.entityType]
      : (Object.keys(ENTITY_CONFIG) as TrashEntityType[]);

  const items: TrashItem[] = [];

  for (const entityType of types) {
    const config = ENTITY_CONFIG[entityType];
    let query = onlyTrashed(db.from(config.table).select("*"))
      .eq("teacher_profile_id", scope.profileId)
      .order("deleted_at", { ascending: false });

    if (filter.matiere && filter.matiere !== "__all__") {
      if (filter.matiere === "__none__") {
        query = query.or("matiere.is.null,matiere.eq.");
      } else {
        query = query.eq("matiere", filter.matiere);
      }
    }

    if (filter.deletedAfter) {
      query = query.gte("deleted_at", filter.deletedAfter);
    }

    const { data, error } = await query;
    if (error) throw error;

    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const parentState = await resolveParentTrashState(entityType, record);
      const dependencySummary = await buildDependencySummary(entityType, String(record.id));
      items.push(
        mapRowToTrashItem(entityType, record, {
          ...parentState,
          dependencySummary,
        }),
      );
    }
  }

  return items.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
  );
}

export async function restoreAllTrash(): Promise<number> {
  const items = await listTrashItems();
  let restored = 0;

  for (const item of items) {
    await restoreFromTrash({
      entityType: item.entityType,
      id: item.id,
      mode: item.parentInTrash ? "with_parent" : "entity_only",
    });
    restored += 1;
  }

  return restored;
}

export async function emptyTrash(): Promise<number> {
  const items = await listTrashItems();
  let deleted = 0;

  for (const item of items) {
    await permanentDeleteFromTrash({ entityType: item.entityType, id: item.id });
    deleted += 1;
  }

  return deleted;
}

export async function findSimilarDocuments(input: {
  entityType: TrashEntityType;
  title: string;
  matiere?: string;
}): Promise<SimilarDocument[]> {
  const scope = await requireTeacherScope();
  const config = ENTITY_CONFIG[input.entityType];
  const normalizedTitle = input.title.trim().toLowerCase();
  if (!normalizedTitle) return [];

  let query = onlyActive(
    (await floraDb())
      .from(config.table)
      .select("id, title, matiere, sous_matiere, created_at")
      .eq("teacher_profile_id", scope.profileId)
      .order("created_at", { ascending: false }),
  );

  if (input.matiere) {
    query = query.eq("matiere", input.matiere);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      return {
        id: String(record.id),
        entityType: input.entityType,
        title: String(record.title ?? ""),
        matiere: String(record.matiere ?? ""),
        sousMatiere: String(record.sous_matiere ?? ""),
        createdAt: String(record.created_at ?? ""),
      };
    })
    .filter((doc) => {
      const docTitle = doc.title.trim().toLowerCase();
      return docTitle === normalizedTitle || docTitle.includes(normalizedTitle) || normalizedTitle.includes(docTitle);
    });
}

export async function getTrashItem(entityType: TrashEntityType, id: string): Promise<TrashItem> {
  const { row } = await loadEntityRow(entityType, id);
  if (!row.deleted_at) throw new Error("Élément actif — absent de la Corbeille.");
  const parentState = await resolveParentTrashState(entityType, row);
  const dependencySummary = await buildDependencySummary(entityType, id);
  return mapRowToTrashItem(entityType, row, { ...parentState, dependencySummary });
}

export async function getRestoreConflict(entityType: TrashEntityType, id: string) {
  const { row } = await loadEntityRow(entityType, id);
  const parentState = await resolveParentTrashState(entityType, row);
  return {
    requiresChoice: parentState.parentInTrash,
    parentId: parentState.parentId,
    parentType: parentState.parentType,
    parentTitle: parentState.parentTitle,
  };
}
