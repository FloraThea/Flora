import { floraDb } from "@/lib/supabase/get-db";
import { loadProgression } from "@/lib/progression/progression-service";
import type { ProgressionRow, ProgressionTab } from "@/lib/progression/types";

export {
  buildSequenceDraftFromGroupedRows,
  buildSequenceDraftFromModuleRows,
  findGroupedRowsForAnchorRow,
  findModuleRowsForAnchorRow,
  groupProgressionRowsByModule,
  groupProgressionRowsByStructure,
  normalizeGroupKey,
  normalizeSequenceGroupKey,
  normalizeSequenceModuleKey,
  resolveGroupLabel,
  shouldUseSequenceRestitution,
} from "./sequence-grouping";

export async function loadAllProgressionRows(progressionId: string): Promise<{
  rows: ProgressionRow[];
  tabs: ProgressionTab[];
}> {
  const payload = await loadProgression(progressionId);
  if (!payload) {
    throw new Error("Progression introuvable.");
  }

  const tabs = payload.tabs;
  const rows = tabs.flatMap((tab) => tab.rows);
  return { rows, tabs };
}

export async function findExistingGroupedSequence(input: {
  progressionId: string;
  groupKey: string;
  groupLabel?: string;
}): Promise<string | null> {
  const { normalizeGroupKey } = await import("./sequence-grouping");
  const { data } = await (await floraDb())
    .from("sequences")
    .select("id, metadata, title")
    .eq("progression_id", input.progressionId)
    .is("deleted_at", null);

  for (const row of data ?? []) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const storedKey = String(metadata.sequenceGroupKey ?? metadata.sequenceModuleKey ?? "");
    const storedLabel = String(metadata.sequenceGroup ?? metadata.sequenceModule ?? row.title ?? "");
    if (storedKey === input.groupKey) return String(row.id);
    if (input.groupLabel && storedLabel === input.groupLabel) return String(row.id);
    if (input.groupLabel && normalizeGroupKey(storedLabel, "module") === input.groupKey) {
      return String(row.id);
    }
  }

  return null;
}

export async function findExistingModuleSequence(input: {
  progressionId: string;
  sequenceModule: string;
}): Promise<string | null> {
  const { normalizeSequenceModuleKey } = await import("./sequence-grouping");
  return findExistingGroupedSequence({
    progressionId: input.progressionId,
    groupKey: normalizeSequenceModuleKey(input.sequenceModule),
    groupLabel: input.sequenceModule,
  });
}
