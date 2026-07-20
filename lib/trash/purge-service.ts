import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { permanentDeleteFromTrash } from "./trash-service";
import type { TrashEntityType } from "./types";

const PURGE_TABLES: Array<{ entityType: TrashEntityType; table: string }> = [
  { entityType: "programmation", table: "programmations" },
  { entityType: "progression", table: "progressions" },
  { entityType: "sequence", table: "sequences" },
  { entityType: "seance", table: "seances" },
];

export type PurgeReport = {
  purged: number;
  errors: Array<{ entityType: TrashEntityType; id: string; message: string }>;
  checkedAt: string;
};

/** Purge automatique des éléments dont purge_after est dépassé. */
export async function purgeExpiredTrashItems(): Promise<PurgeReport> {
  const now = new Date().toISOString();
  const report: PurgeReport = {
    purged: 0,
    errors: [],
    checkedAt: now,
  };

  const db = await floraDb();

  for (const entry of PURGE_TABLES) {
    const { data, error } = await db
      .from(entry.table)
      .select("id")
      .not("deleted_at", "is", null)
      .not("purge_after", "is", null)
      .lte("purge_after", now);

    if (error) {
      report.errors.push({
        entityType: entry.entityType,
        id: "*",
        message: error.message,
      });
      continue;
    }

    for (const row of data ?? []) {
      try {
        await permanentDeleteFromTrash({
          entityType: entry.entityType,
          id: String(row.id),
        });
        report.purged += 1;
        console.info("[corbeille] Purge automatique", {
          entityType: entry.entityType,
          id: row.id,
        });
      } catch (purgeError) {
        report.errors.push({
          entityType: entry.entityType,
          id: String(row.id),
          message: purgeError instanceof Error ? purgeError.message : "Erreur inconnue",
        });
      }
    }
  }

  return report;
}
