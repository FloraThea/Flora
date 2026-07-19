/**
 * Inventaire Supabase — profils et emplois du temps (service role).
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/list-edt-profiles.ts
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
  }

  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: profiles, error: profilesError } = await client
    .from("teacher_profiles")
    .select("id, user_id, nom, prenom, status, created_at")
    .order("created_at", { ascending: true });

  if (profilesError) throw profilesError;

  console.log(`\nProfils enseignants : ${profiles?.length ?? 0}`);
  for (const profile of profiles ?? []) {
    console.log(
      `  - id=${profile.id} user_id=${profile.user_id ?? "null"} status=${profile.status} created=${profile.created_at}`,
    );
  }

  const { data: schedules, error: schedulesError } = await client
    .from("timetable_schedules")
    .select("id, teacher_profile_id, name, is_active, status, created_at")
    .order("created_at", { ascending: true });

  if (schedulesError) throw schedulesError;

  console.log(`\nEmplois du temps : ${schedules?.length ?? 0}`);
  for (const schedule of schedules ?? []) {
    const { count } = await client
      .from("timetable_slots")
      .select("id", { count: "exact", head: true })
      .eq("schedule_id", schedule.id);

    console.log(
      `  - id=${schedule.id} profile_id=${schedule.teacher_profile_id ?? "null"} active=${schedule.is_active} slots=${count ?? 0} name="${schedule.name}"`,
    );
  }

  const orphanProfiles = (profiles ?? []).filter((profile) => !profile.user_id).length;
  const orphanSchedules = (schedules ?? []).filter((schedule) => !schedule.teacher_profile_id).length;
  console.log(`\nOrphelins : ${orphanProfiles} profil(s) sans user_id, ${orphanSchedules} schedule(s) sans teacher_profile_id`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
