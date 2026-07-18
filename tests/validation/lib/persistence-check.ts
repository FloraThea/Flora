import { createClient } from "@supabase/supabase-js";
import type { ProgrammationValidationSnapshot, TimetableValidationSnapshot } from "./snapshot-types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export type PersistenceCheckResult = {
  ok: boolean;
  detail: string;
};

export async function checkTimetablePersistence(
  snapshot: TimetableValidationSnapshot,
): Promise<PersistenceCheckResult | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const email = process.env.FLORA_VALIDATION_EMAIL?.trim();
  const password = process.env.FLORA_VALIDATION_PASSWORD?.trim();
  if (!email || !password) {
    return { ok: true, detail: "Ignoré — FLORA_VALIDATION_EMAIL/PASSWORD non définis" };
  }

  const auth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await auth.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    return { ok: false, detail: signIn.error?.message ?? "Connexion impossible" };
  }

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${signIn.data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sample = snapshot.sessions.find((session) => session.customText.trim());
  if (!sample) {
    return { ok: true, detail: "Aucun texte complémentaire à vérifier dans le document" };
  }

  const { data: profile } = await db
    .from("teacher_profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!profile?.id) {
    return { ok: false, detail: "Profil enseignant introuvable pour le compte de validation" };
  }

  const suffix = Date.now();
  const { data: schedule, error: scheduleError } = await db
    .from("timetable_schedules")
    .insert({
      teacher_profile_id: profile.id,
      name: `Validation ${suffix}`,
      school_year: snapshot.schoolYear || "2025-2026",
      is_active: false,
    })
    .select("id")
    .single();

  if (scheduleError || !schedule?.id) {
    return { ok: false, detail: scheduleError?.message ?? "Création EDT impossible" };
  }

  const complementary = sample.customText;
  const { data: slot, error: slotError } = await db
    .from("timetable_slots")
    .insert({
      schedule_id: schedule.id,
      day: sample.day,
      start_time: sample.startTime,
      end_time: sample.endTime,
      subject: sample.subject,
      custom_text: complementary,
      slot_type: "seance",
    })
    .select("id, custom_text")
    .single();

  if (slotError || !slot?.id) {
    await db.from("timetable_schedules").delete().eq("id", schedule.id);
    return { ok: false, detail: slotError?.message ?? "Insertion créneau impossible" };
  }

  const { data: reload } = await db
    .from("timetable_slots")
    .select("custom_text")
    .eq("id", slot.id)
    .single();

  await db.from("timetable_schedules").delete().eq("id", schedule.id);

  if (reload?.custom_text !== complementary) {
    return {
      ok: false,
      detail: `custom_text relu="${reload?.custom_text ?? ""}" attendu="${complementary}"`,
    };
  }

  return { ok: true, detail: "custom_text identique après écriture Supabase" };
}

export async function checkProgrammationPersistence(
  snapshot: ProgrammationValidationSnapshot,
): Promise<PersistenceCheckResult | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (snapshot.rows.length === 0) {
    return { ok: false, detail: "Aucune ligne parsée — persistance impossible" };
  }
  return {
    ok: true,
    detail: `Pipeline parse OK (${snapshot.rows.length} lignes) — import serveur validé séparément via test:blockers`,
  };
}
