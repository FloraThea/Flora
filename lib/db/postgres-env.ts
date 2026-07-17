export type PostgresEnvStatus = {
  configured: boolean;
  connectionString: string | null;
  host: string | null;
  hint: string | null;
};

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;

  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

function buildDatabaseUrlFromParts(): string | null {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const ref = getSupabaseProjectRef();
  if (!password || !ref) return null;

  const usePooler = process.env.SUPABASE_DB_USE_POOLER === "true";
  if (usePooler) {
    const host =
      process.env.SUPABASE_DB_POOLER_HOST?.trim() ??
      `aws-0-eu-central-1.pooler.supabase.com`;
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:6543/postgres`;
  }

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

function extractHost(connectionString: string): string | null {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return null;
  }
}

export function getPostgresConnectionString(): string | null {
  const direct =
    process.env.SUPABASE_DATABASE_URL?.trim() ??
    process.env.DATABASE_URL?.trim();

  if (direct) return direct;
  return buildDatabaseUrlFromParts();
}

export function getPostgresEnvStatus(): PostgresEnvStatus {
  const connectionString = getPostgresConnectionString();

  if (connectionString) {
    return {
      configured: true,
      connectionString,
      host: extractHost(connectionString),
      hint: null,
    };
  }

  return {
    configured: false,
    connectionString: null,
    host: null,
    hint:
      "Ajoutez SUPABASE_DATABASE_URL (connexion directe Postgres Supabase) ou SUPABASE_DB_PASSWORD " +
      "avec NEXT_PUBLIC_SUPABASE_URL. Aucune CLI Supabase n'est requise.",
  };
}

export function isAutoMigrateEnabled(): boolean {
  if (process.env.FLORA_AUTO_MIGRATE === "false") return false;
  return getPostgresConnectionString() !== null;
}
