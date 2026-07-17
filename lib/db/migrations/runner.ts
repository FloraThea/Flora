import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import pg from "pg";

import { getPostgresConnectionString, getPostgresEnvStatus, isAutoMigrateEnabled } from "../postgres-env";
import type { ApplyMigrationsResult, MigrationEntry, MigrationStatus } from "./types";

const TRACKING_TABLE = "flora_schema_migrations";
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS public.${TRACKING_TABLE} (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  checksum text
);
`;

let migrationLock: Promise<ApplyMigrationsResult> | null = null;

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

async function readMigrationContent(name: string): Promise<string> {
  const filePath = path.join(MIGRATIONS_DIR, name);
  return fs.readFile(filePath, "utf8");
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    throw new Error("Connexion Postgres non configurée.");
  }

  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function fetchAppliedMigrations(client: pg.Client): Promise<Map<string, { appliedAt: string; checksum: string | null }>> {
  await client.query(BOOTSTRAP_SQL);

  const result = await client.query<{ name: string; applied_at: Date; checksum: string | null }>(
    `SELECT name, applied_at, checksum FROM public.${TRACKING_TABLE} ORDER BY name`,
  );

  const map = new Map<string, { appliedAt: string; checksum: string | null }>();
  for (const row of result.rows) {
    map.set(row.name, {
      appliedAt: row.applied_at.toISOString(),
      checksum: row.checksum,
    });
  }
  return map;
}

async function buildMigrationEntries(): Promise<MigrationEntry[]> {
  const files = await listMigrationFiles();

  if (!getPostgresConnectionString()) {
    return files.map((name) => ({
      name,
      status: "pending" as const,
      appliedAt: null,
      checksum: null,
    }));
  }

  return withClient(async (client) => {
    const applied = await fetchAppliedMigrations(client);
    const entries: MigrationEntry[] = [];

    for (const name of files) {
      const record = applied.get(name);
      if (record) {
        entries.push({
          name,
          status: "applied",
          appliedAt: record.appliedAt,
          checksum: record.checksum,
        });
      } else {
        entries.push({
          name,
          status: "pending",
          appliedAt: null,
          checksum: null,
        });
      }
    }

    return entries;
  });
}

export async function getMigrationStatus(): Promise<MigrationStatus> {
  const env = getPostgresEnvStatus();
  const entries = await buildMigrationEntries();
  const pendingCount = entries.filter((entry) => entry.status === "pending").length;
  const appliedCount = entries.filter((entry) => entry.status === "applied").length;

  return {
    configured: env.configured,
    autoMigrateEnabled: isAutoMigrateEnabled(),
    databaseHost: env.host,
    migrationsDir: MIGRATIONS_DIR,
    entries,
    pendingCount,
    appliedCount,
    configurationHint: env.hint,
  };
}

async function applyPendingMigrationsInternal(): Promise<ApplyMigrationsResult> {
  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    return {
      ok: false,
      applied: [],
      skipped: [],
      error: "Connexion Postgres non configurée. Ajoutez SUPABASE_DATABASE_URL dans .env.local.",
    };
  }

  const files = await listMigrationFiles();
  const applied: string[] = [];
  const skipped: string[] = [];

  return withClient(async (client) => {
    const appliedMap = await fetchAppliedMigrations(client);

    for (const name of files) {
      if (appliedMap.has(name)) {
        skipped.push(name);
        continue;
      }

      const sql = await readMigrationContent(name);
      const checksum = sha256(sql);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO public.${TRACKING_TABLE} (name, checksum) VALUES ($1, $2)`,
          [name, checksum],
        );
        await client.query("COMMIT");
        applied.push(name);
        console.info(`[flora/migrations] Appliquée : ${name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        console.error(`[flora/migrations] Échec sur ${name}:`, message);
        return {
          ok: false,
          applied,
          skipped,
          error: `Migration « ${name} » : ${message}`,
        };
      }
    }

    return { ok: true, applied, skipped };
  });
}

export function applyPendingMigrations(): Promise<ApplyMigrationsResult> {
  if (!migrationLock) {
    migrationLock = applyPendingMigrationsInternal().finally(() => {
      migrationLock = null;
    });
  }
  return migrationLock;
}

export async function runAutoMigrationsOnStartup(): Promise<void> {
  if (!isAutoMigrateEnabled()) {
    console.info("[flora/migrations] Auto-migration désactivée ou connexion Postgres absente.");
    return;
  }

  const status = await getMigrationStatus();
  if (status.pendingCount === 0) {
    console.info("[flora/migrations] Base à jour (%d migrations appliquées).", status.appliedCount);
    return;
  }

  console.info(
    "[flora/migrations] %d migration(s) en attente — application automatique…",
    status.pendingCount,
  );

  const result = await applyPendingMigrations();
  if (result.ok) {
    console.info(
      "[flora/migrations] Terminé : %d appliquée(s), %d déjà présente(s).",
      result.applied.length,
      result.skipped.length,
    );
  } else {
    console.error("[flora/migrations] Échec auto-migration :", result.error);
  }
}
