import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/** Client DB : JWT serveur si connecté, sinon anon (fallback single-tenant / tests). */
export async function getDb(): Promise<SupabaseClient> {
  if (typeof window !== "undefined") return supabase;
  try {
    const { getServerSupabase } = await import("@/lib/supabase/server-client");
    return await getServerSupabase();
  } catch {
    return supabase;
  }
}
