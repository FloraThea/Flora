/**
 * Audit live Supabase — tables, RLS, fonctions, migrations.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/audit-supabase-live.ts
 */
async function main() {
  const { getPostgresConnectionString } = await import("../lib/db/postgres-env");
  const pg = await import("pg");

  const connectionString = getPostgresConnectionString();
  if (!connectionString) {
    console.error("SUPABASE_DATABASE_URL requis.");
    process.exit(1);
  }

  const client = new pg.default.Client({
    connectionString,
    ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  const tables = await client.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`,
  );

  const rls = await client.query<{ tablename: string; policyname: string; roles: string }>(
    `select tablename, policyname, array_to_string(roles, ',') as roles
     from pg_policies where schemaname = 'public' order by tablename, policyname`,
  );

  const functions = await client.query<{ proname: string }>(
    `select proname from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and proname like 'flora_%'
     order by proname`,
  );

  const migrations = await client.query<{ name: string; applied_at: Date }>(
    `select name, applied_at from public.flora_schema_migrations order by name`,
  );

  const fkCount = await client.query<{ count: string }>(
    `select count(*)::text as count from information_schema.table_constraints
     where constraint_schema = 'public' and constraint_type = 'FOREIGN KEY'`,
  );

  const indexCount = await client.query<{ count: string }>(
    `select count(*)::text as count from pg_indexes where schemaname = 'public'`,
  );

  const triggers = await client.query<{ tgname: string; relname: string }>(
    `select t.tgname, c.relname
     from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal
     order by c.relname, t.tgname`,
  );

  const openPolicies = rls.rows.filter((p) => p.policyname.includes("_all_anon"));

  console.log("=== Flora Supabase Live Audit ===\n");
  console.log(`Tables publiques : ${tables.rows.length}`);
  console.log(`Politiques RLS   : ${rls.rows.length}`);
  console.log(`Politiques ouvertes (*_all_anon) : ${openPolicies.length}`);
  console.log(`Clés étrangères  : ${fkCount.rows[0]?.count ?? "0"}`);
  console.log(`Index            : ${indexCount.rows[0]?.count ?? "0"}`);
  console.log(`Triggers         : ${triggers.rows.length}`);
  console.log(`Fonctions flora_*: ${functions.rows.map((f) => f.proname).join(", ") || "—"}`);
  console.log(`Migrations appliquées : ${migrations.rows.length}`);

  if (openPolicies.length > 0) {
    console.log("\n⚠️  Politiques encore ouvertes :");
    for (const p of openPolicies.slice(0, 20)) {
      console.log(`  - ${p.tablename}.${p.policyname}`);
    }
    if (openPolicies.length > 20) console.log(`  … et ${openPolicies.length - 20} autres`);
  }

  const tenantPolicies = rls.rows.filter((p) => p.policyname.includes("_tenant"));
  console.log(`\nPolitiques tenant : ${tenantPolicies.length}`);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
