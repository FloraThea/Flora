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
    .select("id")
    .is("user_id", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (orphanError) throw orphanError;

  if (!orphans?.length) {
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

  const orphanIds = orphans.map((orphan) => String(orphan.id));
  const { data: schedules, error: schedulesError } = await client
    .from("timetable_schedules")
    .select("id, teacher_profile_id")
    .in("teacher_profile_id", orphanIds);

  if (schedulesError) throw schedulesError;

  let bestOrphanId = orphanIds[0];
  let bestSlotCount = -1;

  if (schedules?.length) {
    const scheduleIds = schedules.map((schedule) => String(schedule.id));
    const { data: slotRows, error: slotsError } = await client
      .from("timetable_slots")
      .select("schedule_id")
      .in("schedule_id", scheduleIds);

    if (slotsError) throw slotsError;

    const profileCounts = new Map<string, number>();
    const scheduleToProfile = new Map(
      schedules.map((schedule) => [String(schedule.id), String(schedule.teacher_profile_id)]),
    );

    for (const row of slotRows ?? []) {
      const profileId = scheduleToProfile.get(String(row.schedule_id));
      if (!profileId) continue;
      profileCounts.set(profileId, (profileCounts.get(profileId) ?? 0) + 1);
    }

    for (const orphanId of orphanIds) {
      const count = profileCounts.get(orphanId) ?? 0;
      if (count > bestSlotCount) {
        bestSlotCount = count;
        bestOrphanId = orphanId;
      }
    }
  }

  const { error: updateError } = await client
    .from("teacher_profiles")
    .update({ user_id: userId })
    .eq("id", bestOrphanId)
    .is("user_id", null);

  if (updateError) throw updateError;
  return bestOrphanId;
}
