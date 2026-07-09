export type MigrationEntry = {
  name: string;
  status: "applied" | "pending";
  appliedAt: string | null;
  checksum: string | null;
};

export type MigrationStatus = {
  configured: boolean;
  autoMigrateEnabled: boolean;
  databaseHost: string | null;
  migrationsDir: string;
  entries: MigrationEntry[];
  pendingCount: number;
  appliedCount: number;
  configurationHint: string | null;
};

export type ApplyMigrationsResult = {
  ok: boolean;
  applied: string[];
  skipped: string[];
  error?: string;
};
