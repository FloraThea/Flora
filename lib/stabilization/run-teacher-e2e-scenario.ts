/**
 * Scénario E2E enseignant — auth, profil, données pédagogiques, persistance.
 * Usage : node --env-file=.env.local node_modules/tsx/dist/cli.mjs lib/stabilization/run-teacher-e2e-scenario.ts
 *
 * Nécessite NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Crée un compte test éphémère puis le supprime si SUPABASE_SERVICE_ROLE_KEY est défini.
 */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

type StepResult = { step: string; ok: boolean; detail?: string };

function logStep(result: StepResult) {
  const icon = result.ok ? "✓" : "✗";
  console.log(`${icon} ${result.step}${result.detail ? ` — ${result.detail}` : ""}`);
  if (!result.ok) throw new Error(result.step);
}

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("E2E enseignant : ignoré (Supabase non configuré).");
    return;
  }

  const suffix = Date.now();
  const email = `flora-e2e-${suffix}@test.flora.local`;
  const password = `Flora-E2E-${suffix}!`;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const steps: StepResult[] = [];

  // 1. Création de compte
  const { data: signUp, error: signUpError } = await authClient.auth.signUp({ email, password });
  steps.push({
    step: "Création de compte",
    ok: !signUpError && !!signUp.user,
    detail: signUpError?.message,
  });
  logStep(steps.at(-1)!);

  // 2. Connexion
  const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password });
  steps.push({
    step: "Connexion",
    ok: !signInError && !!signIn.session?.access_token,
    detail: signInError?.message,
  });
  logStep(steps.at(-1)!);

  const token = signIn.session!.access_token;
  const userId = signIn.user!.id;

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3. Profil enseignant
  const { data: profile, error: profileError } = await db
    .from("teacher_profiles")
    .insert({
      user_id: userId,
      status: "complete",
      nom: "Dupont",
      prenom: "Marie",
      school_year: "2025-2026",
      zone_scolaire: "A",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création profil enseignant",
    ok: !profileError && !!profile?.id,
    detail: profileError?.message,
  });
  logStep(steps.at(-1)!);

  const profileId = String(profile!.id);

  // 4. Programmation
  const { data: programmation, error: progError } = await db
    .from("programmations")
    .insert({
      teacher_profile_id: profileId,
      title: "E2E Programmation",
      school_year: "2025-2026",
      academic_zone: "A",
      levels: ["CM2"],
      matiere: "Français",
      periode: "",
      theme: "",
      status: "validated",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création programmation",
    ok: !progError && !!programmation?.id,
    detail: progError?.message,
  });
  logStep(steps.at(-1)!);

  // 5. Progression standalone
  const { data: progression, error: prog2Error } = await db
    .from("progressions")
    .insert({
      teacher_profile_id: profileId,
      title: "E2E Progression",
      link_mode: "standalone",
      status: "validated",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création progression",
    ok: !prog2Error && !!progression?.id,
    detail: prog2Error?.message,
  });
  logStep(steps.at(-1)!);

  // 6. Séquence indépendante
  const { data: sequence, error: seqError } = await db
    .from("sequences")
    .insert({
      teacher_profile_id: profileId,
      title: "E2E Séquence",
      matiere: "Français",
      link_mode: "standalone",
      status: "draft",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création séquence",
    ok: !seqError && !!sequence?.id,
    detail: seqError?.message,
  });
  logStep(steps.at(-1)!);

  // 7. Séance indépendante
  const { data: seance, error: seanceError } = await db
    .from("seances")
    .insert({
      teacher_profile_id: profileId,
      title: "E2E Séance",
      matiere: "Français",
      link_mode: "standalone",
      status: "draft",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création séance",
    ok: !seanceError && !!seance?.id,
    detail: seanceError?.message,
  });
  logStep(steps.at(-1)!);

  // 8. Emploi du temps
  const { data: schedule, error: scheduleError } = await db
    .from("timetable_schedules")
    .insert({
      teacher_profile_id: profileId,
      name: "E2E EDT",
      school_year: "2025-2026",
      is_active: true,
    })
    .select("id")
    .single();

  steps.push({
    step: "Création emploi du temps",
    ok: !scheduleError && !!schedule?.id,
    detail: scheduleError?.message,
  });
  logStep(steps.at(-1)!);

  // 9. Agenda
  const today = new Date().toISOString().slice(0, 10);
  const { data: event, error: eventError } = await db
    .from("agenda_events")
    .insert({
      teacher_profile_id: profileId,
      title: "E2E Événement",
      titre: "E2E Événement",
      date_event: today,
      school_year: "2025-2026",
      event_type: "custom",
      type_event: "custom",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création agenda",
    ok: !eventError && !!event?.id,
    detail: eventError?.message,
  });
  logStep(steps.at(-1)!);

  // 10. Cahier journal
  const { data: journal, error: journalError } = await db
    .from("journals")
    .insert({
      teacher_profile_id: profileId,
      journal_date: today,
      school_year: "2025-2026",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création cahier journal",
    ok: !journalError && !!journal?.id,
    detail: journalError?.message,
  });
  logStep(steps.at(-1)!);

  // 11. Document bibliothèque
  const { data: document, error: docError } = await db
    .from("documents")
    .insert({
      teacher_profile_id: profileId,
      title: "E2E Document",
      original_filename: "e2e-test.pdf",
      document_type: "programmation",
      status: "ready",
    })
    .select("id")
    .single();

  steps.push({
    step: "Création document bibliothèque",
    ok: !docError && !!document?.id,
    detail: docError?.message,
  });
  logStep(steps.at(-1)!);

  // 12. Déconnexion (simulée)
  await authClient.auth.signOut();
  steps.push({ step: "Déconnexion", ok: true });
  logStep(steps.at(-1)!);

  // 13. Reconnexion
  const { data: signIn2, error: signIn2Error } = await authClient.auth.signInWithPassword({ email, password });
  steps.push({
    step: "Reconnexion",
    ok: !signIn2Error && !!signIn2.session?.access_token,
    detail: signIn2Error?.message,
  });
  logStep(steps.at(-1)!);

  const db2 = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${signIn2.session!.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 14. Vérification persistance
  const { count: progCount } = await db2
    .from("programmations")
    .select("id", { count: "exact", head: true })
    .eq("teacher_profile_id", profileId);

  const { count: docCount } = await db2
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("teacher_profile_id", profileId);

  steps.push({
    step: "Persistance données après reconnexion",
    ok: (progCount ?? 0) >= 1 && (docCount ?? 0) >= 1,
    detail: `programmations=${progCount}, documents=${docCount}`,
  });
  logStep(steps.at(-1)!);

  // 15. Isolation — autre utilisateur ne voit pas les données
  const otherEmail = `flora-e2e-other-${suffix}@test.flora.local`;
  await authClient.auth.signUp({ email: otherEmail, password });
  const { data: otherSignIn } = await authClient.auth.signInWithPassword({ email: otherEmail, password });
  const otherDb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${otherSignIn.session!.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: leakedCount } = await otherDb
    .from("programmations")
    .select("id", { count: "exact", head: true })
    .eq("teacher_profile_id", profileId);

  steps.push({
    step: "Isolation RLS (autre utilisateur)",
    ok: (leakedCount ?? 0) === 0,
    detail: `rows visibles=${leakedCount ?? 0}`,
  });
  logStep(steps.at(-1)!);

  // Cleanup via service role si disponible
  if (serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.from("teacher_profiles").delete().eq("id", profileId);
    await admin.auth.admin.deleteUser(userId);
    await admin.auth.admin.deleteUser(otherSignIn.user!.id);
    console.log("✓ Nettoyage comptes test (service role)");
  } else {
    console.log("⚠ Nettoyage manuel requis (SUPABASE_SERVICE_ROLE_KEY absent)");
  }

  console.log(`\nE2E enseignant : ${steps.length}/${steps.length} étapes OK`);
}

main().catch((error) => {
  console.error("\nE2E enseignant ÉCHEC :", error instanceof Error ? error.message : error);
  process.exit(1);
});
