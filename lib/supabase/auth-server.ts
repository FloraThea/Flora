import "server-only";

import { type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { createSupabaseWithToken } from "@/lib/supabase/server-client";

export async function getServerAuthUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("flora-auth-token")?.value?.trim();
  if (!accessToken) return null;

  const client = createSupabaseWithToken(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

export async function getServerAuthUserId(): Promise<string | null> {
  const user = await getServerAuthUser();
  return user?.id ?? null;
}

/** Lie le profil enseignant au compte auth (crée ou réutilise un profil lié). */
export async function linkTeacherProfileToAuthUser(
  userId: string,
  accessToken?: string,
): Promise<string> {
  const cookieStore = await cookies();
  const token = accessToken ?? cookieStore.get("flora-auth-token")?.value?.trim();
  const client = token ? createSupabaseWithToken(token) : supabase;

  const { data: linked, error: linkedError } = await client
    .from("teacher_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (linkedError) throw linkedError;
  if (linked?.id) return String(linked.id);

  const { data: orphans, error: orphanError } = await client
    .from("teacher_profiles")
    .select("id, created_at")
    .is("user_id", null)
    .order("created_at", { ascending: true });

  if (orphanError) throw orphanError;

  let bestOrphanId: string | null = null;
  let bestSlotCount = -1;

  for (const orphan of orphans ?? []) {
    const { data: schedules } = await client
      .from("timetable_schedules")
      .select("id")
      .eq("teacher_profile_id", orphan.id);

    let profileSlotCount = 0;
    for (const schedule of schedules ?? []) {
      const { count } = await client
        .from("timetable_slots")
        .select("id", { count: "exact", head: true })
        .eq("schedule_id", schedule.id);
      profileSlotCount += count ?? 0;
    }

    if (profileSlotCount > bestSlotCount) {
      bestSlotCount = profileSlotCount;
      bestOrphanId = String(orphan.id);
    }
  }

  const orphanId = bestOrphanId ?? (orphans?.[0]?.id ? String(orphans[0].id) : null);

  if (orphanId) {
    const { error: updateError } = await client
      .from("teacher_profiles")
      .update({ user_id: userId })
      .eq("id", orphanId)
      .is("user_id", null);

    if (updateError) throw updateError;
    return orphanId;
  }

  const { data: created, error: createError } = await client
    .from("teacher_profiles")
    .insert({ status: "draft", user_id: userId })
    .select("id")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Impossible de créer le profil lié au compte.");
  }

  return String(created.id);
}
