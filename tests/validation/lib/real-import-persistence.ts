import { createClient } from "@supabase/supabase-js";
import type { ParsedProgrammationRow } from "@/lib/programming/import/types";
import type { TimetableImportSession } from "@/lib/timetable/import/types";
import { importSessionToSlot } from "@/lib/timetable/import/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export type RealPersistenceResult = {
  ok: boolean;
  detail: string;
  entityId: string | null;
  afterTabSwitch: boolean;
  afterRefresh: boolean;
  afterReconnect: boolean;
  supabaseVerified: boolean;
};

type TestSession = {
  auth: ReturnType<typeof createClient>;
  db: ReturnType<typeof createClient>;
  email: string;
  password: string;
  userId: string;
  profileId: string;
};

async function createTestSession(prefix: string): Promise<TestSession> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase non configuré");
  }

  const suffix = Date.now();
  const email = `flora-${prefix}-real-${suffix}@test.flora.local`;
  const password = `Flora-${prefix}-${suffix}!`;

  const auth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signUp = await auth.auth.signUp({ email, password });
  if (signUp.error || !signUp.data.user) {
    throw new Error(signUp.error?.message ?? "Inscription impossible");
  }

  const signIn = await auth.auth.signInWithPassword({ email, password });
  const token = signIn.data.session?.access_token;
  const userId = signIn.data.user?.id;
  if (!token || !userId) {
    throw new Error("Connexion impossible");
  }

  const db = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await db
    .from("teacher_profiles")
    .insert({
      user_id: userId,
      status: "complete",
      nom: "Test",
      prenom: prefix.toUpperCase(),
      school_year: "2026-2027",
      zone_scolaire: "A",
    })
    .select("id")
    .single();

  if (!profile?.id) {
    throw new Error("Profil enseignant non créé");
  }

  return {
    auth,
    db,
    email,
    password,
    userId,
    profileId: String(profile.id),
  };
}

async function reconnectDb(session: TestSession) {
  await session.auth.auth.signOut();
  const signIn2 = await session.auth.auth.signInWithPassword({
    email: session.email,
    password: session.password,
  });
  if (!signIn2.data.session?.access_token) {
    throw new Error("Reconnexion impossible");
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { headers: { Authorization: `Bearer ${signIn2.data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function cleanupTestSession(session: TestSession) {
  if (!supabaseUrl || !serviceRoleKey) return;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("teacher_profiles").delete().eq("id", session.profileId);
  await admin.auth.admin.deleteUser(session.userId);
}

function missingSupabase(): RealPersistenceResult {
  return {
    ok: false,
    detail: "Supabase non configuré",
    entityId: null,
    afterTabSwitch: false,
    afterRefresh: false,
    afterReconnect: false,
    supabaseVerified: false,
  };
}

function failure(detail: string): RealPersistenceResult {
  return {
    ok: false,
    detail,
    entityId: null,
    afterTabSwitch: false,
    afterRefresh: false,
    afterReconnect: false,
    supabaseVerified: false,
  };
}

export async function persistProgrammationRows(input: {
  prefix: string;
  fileName: string;
  title: string;
  matiere: string;
  rows: ParsedProgrammationRow[];
}): Promise<RealPersistenceResult> {
  if (!supabaseUrl || !supabaseAnonKey) return missingSupabase();

  let session: TestSession;
  try {
    session = await createTestSession(input.prefix);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Session test impossible");
  }

  const { data: programmation, error } = await session.db
    .from("programmations")
    .insert({
      teacher_profile_id: session.profileId,
      title: input.title,
      school_year: "2026-2027",
      academic_zone: "A",
      levels: ["CE1", "CE2"],
      matiere: input.matiere,
      periode: "",
      theme: "",
      status: "validated",
      source_type: "imported",
      source_file_name: input.fileName,
      discipline: input.matiere,
      original_import: { rows: input.rows, fileName: input.fileName, rowCount: input.rows.length },
    })
    .select("id, original_import")
    .single();

  if (error || !programmation?.id) {
    await cleanupTestSession(session);
    return failure(error?.message ?? "Insert programmation échoué");
  }

  const list1 = await session.db
    .from("programmations")
    .select("id")
    .eq("teacher_profile_id", session.profileId);
  const afterTabSwitch = list1.data?.some((item) => item.id === programmation.id) ?? false;

  let db2;
  try {
    db2 = await reconnectDb(session);
  } catch (error) {
    await cleanupTestSession(session);
    return failure(error instanceof Error ? error.message : "Reconnexion impossible");
  }

  const { data: reload } = await db2
    .from("programmations")
    .select("id, original_import, status")
    .eq("id", programmation.id)
    .single();

  const importedRows = (reload?.original_import as { rows?: unknown[] } | null)?.rows ?? [];
  const afterRefresh = !!reload;
  const afterReconnect = importedRows.length === input.rows.length;
  const supabaseVerified = afterReconnect;

  await cleanupTestSession(session);

  return {
    ok: afterTabSwitch && afterRefresh && afterReconnect && supabaseVerified,
    detail: `visible=${afterTabSwitch}, reload=${afterRefresh}, rows=${importedRows.length}/${input.rows.length}`,
    entityId: String(programmation.id),
    afterTabSwitch,
    afterRefresh,
    afterReconnect,
    supabaseVerified,
  };
}

export async function persistProgressionRows(input: {
  fileName: string;
  title: string;
  rows: ParsedProgrammationRow[];
}): Promise<RealPersistenceResult> {
  if (!supabaseUrl || !supabaseAnonKey) return missingSupabase();

  let session: TestSession;
  try {
    session = await createTestSession("emc");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Session test impossible");
  }

  const { data: progression, error } = await session.db
    .from("progressions")
    .insert({
      teacher_profile_id: session.profileId,
      programmation_id: null,
      title: input.title,
      methode: "",
      validation: { valid: true, errors: [], warnings: [] },
      calendar_snapshot: {},
      status: "validated",
      link_mode: "independent",
      metadata: {
        source_type: "imported",
        source_file_name: input.fileName,
        original_import: { rows: input.rows, fileName: input.fileName, rowCount: input.rows.length },
      },
    })
    .select("id, metadata")
    .single();

  if (error || !progression?.id) {
    await cleanupTestSession(session);
    return failure(error?.message ?? "Insert progression échoué");
  }

  const list1 = await session.db
    .from("progressions")
    .select("id")
    .eq("teacher_profile_id", session.profileId);
  const afterTabSwitch = list1.data?.some((item) => item.id === progression.id) ?? false;

  let db2;
  try {
    db2 = await reconnectDb(session);
  } catch (reconnectError) {
    await cleanupTestSession(session);
    return failure(reconnectError instanceof Error ? reconnectError.message : "Reconnexion impossible");
  }

  const { data: reload } = await db2
    .from("progressions")
    .select("id, metadata, status")
    .eq("id", progression.id)
    .single();

  const importedRows =
    ((reload?.metadata as { original_import?: { rows?: unknown[] } } | null)?.original_import?.rows ??
      []) as unknown[];
  const afterRefresh = !!reload;
  const afterReconnect = importedRows.length === input.rows.length;

  await cleanupTestSession(session);

  return {
    ok: afterTabSwitch && afterRefresh && afterReconnect,
    detail: `visible=${afterTabSwitch}, reload=${afterRefresh}, rows=${importedRows.length}/${input.rows.length}`,
    entityId: String(progression.id),
    afterTabSwitch,
    afterRefresh,
    afterReconnect,
    supabaseVerified: afterReconnect,
  };
}

export type GuidePersistenceSnapshot = {
  pageCount: number | null;
  textLength: number;
  methode: string;
  documentType: string;
  competenceMatches: number;
  objectifMatches: number;
};

export type GuidePersistenceResult = RealPersistenceResult & {
  stored: GuidePersistenceSnapshot;
  reloaded: GuidePersistenceSnapshot;
};

function guideSnapshotFromMetadata(metadata: Record<string, unknown> | null | undefined): GuidePersistenceSnapshot {
  const validation = (metadata?.validation_real_test ?? {}) as Record<string, unknown>;
  return {
    pageCount: typeof validation.pageCount === "number" ? validation.pageCount : null,
    textLength: typeof validation.textLength === "number" ? validation.textLength : 0,
    methode: typeof validation.methode === "string" ? validation.methode : "",
    documentType: typeof validation.documentType === "string" ? validation.documentType : "",
    competenceMatches:
      typeof validation.competenceMatches === "number" ? validation.competenceMatches : 0,
    objectifMatches: typeof validation.objectifMatches === "number" ? validation.objectifMatches : 0,
  };
}

export async function persistGuideDocument(input: {
  fileName: string;
  fileSize: number;
  snapshot: {
    documentType: string;
    methodDetected: string;
    stats: {
      textLength: number;
      pageCount: number | null;
      competenceMatches: number;
      objectifMatches: number;
    };
  };
  previewText: string;
}): Promise<GuidePersistenceResult> {
  const stored: GuidePersistenceSnapshot = {
    pageCount: input.snapshot.stats.pageCount,
    textLength: input.snapshot.stats.textLength,
    methode: input.snapshot.methodDetected,
    documentType: input.snapshot.documentType,
    competenceMatches: input.snapshot.stats.competenceMatches,
    objectifMatches: input.snapshot.stats.objectifMatches,
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ...missingSupabase(),
      stored,
      reloaded: stored,
    };
  }

  let session: TestSession;
  try {
    session = await createTestSession("mhm");
  } catch (error) {
    return {
      ...failure(error instanceof Error ? error.message : "Session test impossible"),
      stored,
      reloaded: stored,
    };
  }

  const storagePath = `validation/${Date.now()}-${input.fileName}`;
  const { data: document, error } = await session.db
    .from("documents")
    .insert({
      teacher_profile_id: session.profileId,
      title: input.fileName.replace(/\.[^.]+$/, ""),
      original_filename: input.fileName,
      document_type: input.snapshot.documentType,
      file_extension: "pdf",
      file_size: input.fileSize,
      storage_path: storagePath,
      status: "uploaded",
      methode: input.snapshot.methodDetected,
      matiere: "Mathématiques",
      niveau: "CE1 CE2",
      resume: input.previewText.slice(0, 500),
      metadata: {
        validation_real_test: stored,
        page_count: input.snapshot.stats.pageCount,
        import_source: "validation_real_test",
      },
    })
    .select("id, metadata, methode, document_type")
    .single();

  if (error || !document?.id) {
    await cleanupTestSession(session);
    return {
      ...failure(error?.message ?? "Insert document échoué"),
      stored,
      reloaded: stored,
    };
  }

  const list1 = await session.db
    .from("documents")
    .select("id")
    .eq("teacher_profile_id", session.profileId);
  const afterTabSwitch = list1.data?.some((item) => item.id === document.id) ?? false;

  let db2;
  try {
    db2 = await reconnectDb(session);
  } catch (reconnectError) {
    await session.db.from("documents").delete().eq("id", document.id);
    await cleanupTestSession(session);
    return {
      ...failure(reconnectError instanceof Error ? reconnectError.message : "Reconnexion impossible"),
      stored,
      reloaded: stored,
    };
  }

  const { data: reload } = await db2
    .from("documents")
    .select("id, metadata, methode, document_type, status")
    .eq("id", document.id)
    .single();

  const reloaded = guideSnapshotFromMetadata(
    (reload?.metadata as Record<string, unknown> | null) ?? null,
  );
  const afterRefresh = !!reload;
  const afterReconnect =
    reloaded.textLength === stored.textLength &&
    reloaded.methode === stored.methode &&
    reloaded.pageCount === stored.pageCount;

  await db2.from("documents").delete().eq("id", document.id);
  await cleanupTestSession(session);

  return {
    ok: afterTabSwitch && afterRefresh && afterReconnect,
    detail: `visible=${afterTabSwitch}, reload=${afterRefresh}, text=${reloaded.textLength}/${stored.textLength}`,
    entityId: String(document.id),
    afterTabSwitch,
    afterRefresh,
    afterReconnect,
    supabaseVerified: afterReconnect,
    stored,
    reloaded,
  };
}

export async function persistTimetableSessions(input: {
  fileName: string;
  scheduleName: string;
  schoolYear: string;
  sessions: TimetableImportSession[];
}): Promise<RealPersistenceResult> {
  if (!supabaseUrl || !supabaseAnonKey) return missingSupabase();

  let session: TestSession;
  try {
    session = await createTestSession("edt");
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Session test impossible");
  }

  const { data: schedule, error: scheduleError } = await session.db
    .from("timetable_schedules")
    .insert({
      teacher_profile_id: session.profileId,
      name: input.scheduleName,
      school_year: input.schoolYear || "2025-2026",
      is_active: true,
    })
    .select("id")
    .single();

  if (scheduleError || !schedule?.id) {
    await cleanupTestSession(session);
    return failure(scheduleError?.message ?? "Création EDT impossible");
  }

  const activeSessions = input.sessions.filter((sessionItem) => !sessionItem.isEmpty);
  const slots = activeSessions.map((sessionItem) => {
    const slot = importSessionToSlot(sessionItem, String(schedule.id));
    return {
      schedule_id: schedule.id,
      day: slot.day,
      start_time: slot.start,
      end_time: slot.end,
      subject: slot.subject,
      sub_subject: slot.subSubject,
      custom_text: slot.customText,
      slot_type: slot.slotType,
      label: slot.label,
      metadata: slot.metadata,
    };
  });

  const { error: slotsError } = await session.db.from("timetable_slots").insert(slots);
  if (slotsError) {
    await session.db.from("timetable_schedules").delete().eq("id", schedule.id);
    await cleanupTestSession(session);
    return failure(slotsError.message);
  }

  const list1 = await session.db
    .from("timetable_schedules")
    .select("id")
    .eq("teacher_profile_id", session.profileId);
  const afterTabSwitch = list1.data?.some((item) => item.id === schedule.id) ?? false;

  const { count } = await session.db
    .from("timetable_slots")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", schedule.id);

  let db2;
  try {
    db2 = await reconnectDb(session);
  } catch (reconnectError) {
    await session.db.from("timetable_schedules").delete().eq("id", schedule.id);
    await cleanupTestSession(session);
    return failure(reconnectError instanceof Error ? reconnectError.message : "Reconnexion impossible");
  }

  const { data: reloadSchedule } = await db2
    .from("timetable_schedules")
    .select("id, name")
    .eq("id", schedule.id)
    .single();

  const { count: reloadCount } = await db2
    .from("timetable_slots")
    .select("id", { count: "exact", head: true })
    .eq("schedule_id", schedule.id);

  const afterRefresh = !!reloadSchedule;
  const afterReconnect = reloadCount === activeSessions.length;
  const supabaseVerified = count === activeSessions.length && afterReconnect;

  await db2.from("timetable_schedules").delete().eq("id", schedule.id);
  await cleanupTestSession(session);

  return {
    ok: afterTabSwitch && afterRefresh && afterReconnect && supabaseVerified,
    detail: `visible=${afterTabSwitch}, reload=${afterRefresh}, slots=${reloadCount}/${activeSessions.length}`,
    entityId: String(schedule.id),
    afterTabSwitch,
    afterRefresh,
    afterReconnect,
    supabaseVerified,
  };
}
