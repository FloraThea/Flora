/**
 * Applique les migrations SQL en attente sur la base Supabase configurée.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/apply-pending-migrations.ts
 */
async function main() {
  const { applyPendingMigrations, getMigrationStatus } = await import("../lib/db/migrations/runner");

  const before = await getMigrationStatus();
  console.log(
    `[migrations] ${before.appliedCount} appliquée(s), ${before.pendingCount} en attente` +
      (before.databaseHost ? ` — ${before.databaseHost}` : ""),
  );

  if (!before.configured) {
    console.error(before.configurationHint ?? "Connexion Postgres non configurée.");
    process.exit(1);
  }

  if (before.pendingCount === 0) {
    console.log("[migrations] Base déjà à jour.");
    return;
  }

  const result = await applyPendingMigrations();
  if (!result.ok) {
    console.error("[migrations] Échec :", result.error);
    console.error("Appliquées avant échec :", result.applied.join(", ") || "—");
    process.exit(1);
  }

  const after = await getMigrationStatus();
  console.log(
    `[migrations] OK — ${result.applied.length} nouvelle(s), ${result.skipped.length} déjà présente(s).`,
  );
  console.log(`[migrations] Total appliquées : ${after.appliedCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
