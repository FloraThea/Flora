import { floraDb } from "@/lib/supabase/get-db";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type {
  ChangeLogEntry,
  PedagogicalEventType,
  PedagogicalModule,
  RevertResult,
} from "./types";

export async function logPedagogicalChange(input: {
  module: PedagogicalModule;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue: unknown;
  newValue: unknown;
  eventType: PedagogicalEventType;
}): Promise<string | null> {
  const bundle = await loadTeacherProfileBundle();

  const { data, error } = await (await floraDb())
    .from("pedagogical_change_log")
    .insert({
      teacher_profile_id: bundle?.profile.id ?? null,
      module: input.module,
      entity_type: input.entityType,
      entity_id: input.entityId,
      field_name: input.fieldName ?? null,
      old_value: input.oldValue,
      new_value: input.newValue,
      event_type: input.eventType,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[PedagogicalEngine] Historique non enregistré:", error.message);
    return null;
  }

  return data?.id ? String(data.id) : null;
}

export async function listPedagogicalChanges(limit = 50): Promise<ChangeLogEntry[]> {
  const { data, error } = await (await floraDb())
    .from("pedagogical_change_log")
    .select("*")
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  return (data ?? []).map(mapChangeLogRow);
}

export async function listEntityPedagogicalHistory(input: {
  entityType: string;
  entityId: string;
  limit?: number;
}): Promise<ChangeLogEntry[]> {
  const { data, error } = await (await floraDb())
    .from("pedagogical_change_log")
    .select("*")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);

  if (error) return [];
  return (data ?? []).map(mapChangeLogRow);
}

export function comparePedagogicalVersions(
  left: ChangeLogEntry,
  right: ChangeLogEntry,
): { fieldName?: string; leftValue: unknown; rightValue: unknown; changedAtLeft: string; changedAtRight: string } {
  return {
    fieldName: left.fieldName ?? right.fieldName,
    leftValue: left.newValue,
    rightValue: right.newValue,
    changedAtLeft: left.createdAt,
    changedAtRight: right.createdAt,
  };
}

export async function findPedagogicalSnapshot(input: {
  entityType: string;
  entityId: string;
  anchor: "yesterday" | "last_week" | "last_month";
}): Promise<ChangeLogEntry | null> {
  const now = Date.now();
  const offsets = {
    yesterday: 24 * 60 * 60 * 1000,
    last_week: 7 * 24 * 60 * 60 * 1000,
    last_month: 30 * 24 * 60 * 60 * 1000,
  };
  const target = new Date(now - offsets[input.anchor]).toISOString();

  const { data, error } = await (await floraDb())
    .from("pedagogical_change_log")
    .select("*")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .lte("created_at", target)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapChangeLogRow(data);
}

export async function revertPedagogicalChange(logId: string): Promise<RevertResult> {
  const { data: entry, error } = await (await floraDb())
    .from("pedagogical_change_log")
    .select("*")
    .eq("id", logId)
    .maybeSingle();

  if (error || !entry) {
    return { ok: false, logId, message: "Entrée d'historique introuvable." };
  }

  if (entry.reverted_at) {
    return { ok: false, logId, message: "Cette modification a déjà été annulée." };
  }

  const restored = await applyRevert(entry);
  if (!restored.ok) return restored;

  await (await floraDb())
    .from("pedagogical_change_log")
    .update({ reverted_at: new Date().toISOString() })
    .eq("id", logId);

  return { ok: true, logId, message: "Modification restaurée." };
}

async function applyRevert(entry: Record<string, unknown>): Promise<RevertResult> {
  const entityType = String(entry.entity_type ?? "");
  const entityId = String(entry.entity_id ?? "");
  const fieldName = entry.field_name ? String(entry.field_name) : null;
  const oldValue = entry.old_value;

  if (entityType === "programming_cell" && fieldName) {
    const { error } = await (await floraDb())
      .from("programming_cells")
      .update({ [fieldName]: oldValue, updated_at: new Date().toISOString() })
      .eq("id", entityId);
    if (error) return { ok: false, logId: String(entry.id), message: error.message };
  }

  if (entityType === "progression_row" && fieldName) {
    const { error } = await (await floraDb())
      .from("progression_rows")
      .update({ [fieldName]: oldValue, updated_at: new Date().toISOString() })
      .eq("id", entityId);
    if (error) return { ok: false, logId: String(entry.id), message: error.message };
  }

  if (entityType === "seance" && fieldName) {
    const { error } = await (await floraDb())
      .from("seances")
      .update({ [fieldName]: oldValue, updated_at: new Date().toISOString() })
      .eq("id", entityId);
    if (error) return { ok: false, logId: String(entry.id), message: error.message };
  }

  return {
    ok: true,
    logId: String(entry.id),
    message: "Valeur précédente restaurée.",
  };
}

function mapChangeLogRow(row: Record<string, unknown>): ChangeLogEntry {
  return {
    id: String(row.id),
    module: String(row.module) as PedagogicalModule,
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    fieldName: row.field_name ? String(row.field_name) : undefined,
    oldValue: row.old_value,
    newValue: row.new_value,
    eventType: String(row.event_type) as PedagogicalEventType,
    createdAt: String(row.created_at),
    revertedAt: row.reverted_at ? String(row.reverted_at) : undefined,
  };
}
