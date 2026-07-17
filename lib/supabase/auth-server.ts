import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function createAuthClient(accessToken: string): SupabaseClient {
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

export async function getServerAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("flora-auth-token")?.value?.trim();
  if (!accessToken) return null;

  const client = createAuthClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function getServerAuthUserId(): Promise<string | null> {
  const user = await getServerAuthUser();
  return user?.id ?? null;
}

/** Lie le profil enseignant au compte auth (crée ou réutilise un profil lié). */
export async function linkTeacherProfileToAuthUser(userId: string): Promise<string> {
  const { data: linked, error: linkedError } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (linkedError) throw linkedError;
  if (linked?.id) return String(linked.id);

  const { data: orphan, error: orphanError } = await supabase
    .from("teacher_profiles")
    .select("id")
    .is("user_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (orphanError) throw orphanError;

  if (orphan?.id) {
    const { error: updateError } = await supabase
      .from("teacher_profiles")
      .update({ user_id: userId })
      .eq("id", orphan.id)
      .is("user_id", null);

    if (updateError) throw updateError;
    return String(orphan.id);
  }

  const { data: created, error: createError } = await supabase
    .from("teacher_profiles")
    .insert({ status: "draft", user_id: userId })
    .select("id")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Impossible de créer le profil lié au compte.");
  }

  return String(created.id);
}
