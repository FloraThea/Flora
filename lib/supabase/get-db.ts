import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Client DB : JWT serveur si connecté, sinon anon (fallback single-tenant / tests). */
export async function getDb(): Promise<SupabaseClient> {
  if (typeof window !== "undefined") return supabase;

  if (
    process.env.FLORA_TEST_USE_SERVICE_ROLE === "1" &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  ) {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  try {
    const { getServerSupabase } = await import("@/lib/supabase/server-client");
    return await getServerSupabase();
  } catch {
    return supabase;
  }
}

/** Alias explicite pour les services serveur tenant-scopés. */
export const floraDb = getDb;
