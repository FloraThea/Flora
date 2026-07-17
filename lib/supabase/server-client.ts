import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export function createSupabaseWithToken(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase non configuré.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Client Supabase serveur avec JWT utilisateur (cookie flora-auth-token) pour RLS auth.uid(). */
export async function getServerSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("flora-auth-token")?.value?.trim();
  if (!accessToken) return supabase;
  return createSupabaseWithToken(accessToken);
}

export async function getServerAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("flora-auth-token")?.value?.trim() ?? null;
}
