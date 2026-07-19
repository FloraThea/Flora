import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export type ApiTestSession = {
  baseUrl: string;
  email: string;
  password: string;
  userId: string;
  profileId: string;
  accessToken: string;
  cookieHeader: string;
  authClient: SupabaseClient;
  dbClient: SupabaseClient;
};

export type ApiJson = Record<string, unknown>;

function requireSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).");
  }
  return { supabaseUrl, supabaseAnonKey };
}

export async function assertServerReachable(baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/session`, {
      signal: controller.signal,
    });
    if (!response.ok && response.status !== 401) {
      throw new Error(`Serveur injoignable (${response.status}).`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Serveur Flora injoignable sur ${baseUrl}. Lancez « npm run dev » (vérifiez le port affiché) puis relancez le test.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function setupCompleteTeacherProfile(
  dbClient: SupabaseClient,
  profileId: string,
): Promise<void> {
  const { data: existingMethods } = await dbClient
    .from("teacher_methods")
    .select("id")
    .eq("profile_id", profileId)
    .limit(1);

  if (!existingMethods?.length) {
    const { error: methodError } = await dbClient.from("teacher_methods").insert({
      profile_id: profileId,
      method_name: "MHM",
      is_primary: true,
      sort_order: 0,
    });
    if (methodError) throw new Error(methodError.message);
  }

  const { data: existingSchedule } = await dbClient
    .from("timetable_schedules")
    .select("id")
    .eq("teacher_profile_id", profileId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!existingSchedule?.id) {
    const { data: schedule, error: scheduleError } = await dbClient
      .from("timetable_schedules")
      .insert({
        teacher_profile_id: profileId,
        name: "EDT validation API",
        school_year: "2026-2027",
        is_active: true,
      })
      .select("id")
      .single();

    if (scheduleError || !schedule?.id) {
      throw new Error(scheduleError?.message ?? "Création EDT test impossible");
    }

    const { error: slotError } = await dbClient.from("timetable_slots").insert({
      schedule_id: schedule.id,
      day: "Lundi",
      start_time: "08:30",
      end_time: "09:00",
      subject: "Français",
      slot_type: "seance",
    });

    if (slotError) throw new Error(slotError.message);
  }
}

function buildCookieHeader(linkResponse: Response, accessToken: string): string {
  const setCookies =
    typeof linkResponse.headers.getSetCookie === "function"
      ? linkResponse.headers.getSetCookie()
      : [];

  if (setCookies.length > 0) {
    return setCookies.map((entry) => entry.split(";")[0] ?? "").filter(Boolean).join("; ");
  }

  return `flora-auth-token=${accessToken}`;
}

export async function createApiTestSession(baseUrl: string): Promise<ApiTestSession> {
  const { supabaseUrl, supabaseAnonKey } = requireSupabaseConfig();
  await assertServerReachable(baseUrl);

  const suffix = Date.now();
  const email = `flora-api-real-${suffix}@test.flora.local`;
  const password = `Flora-API-${suffix}!`;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signUp = await authClient.auth.signUp({ email, password });
  if (signUp.error || !signUp.data.user) {
    throw new Error(signUp.error?.message ?? "Inscription impossible");
  }

  const signIn = await authClient.auth.signInWithPassword({ email, password });
  const accessToken = signIn.data.session?.access_token;
  const userId = signIn.data.user?.id;
  if (!accessToken || !userId) {
    throw new Error("Connexion impossible");
  }

  const linkResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/link-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      refreshToken: signIn.data.session?.refresh_token,
    }),
  });

  const linkData = (await linkResponse.json()) as { error?: string; profileId?: string };
  if (!linkResponse.ok || !linkData.profileId) {
    throw new Error(linkData.error ?? "Liaison profil impossible");
  }

  const cookieHeader = buildCookieHeader(linkResponse, accessToken);

  const dbClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: profileError } = await dbClient
    .from("teacher_profiles")
    .update({
      status: "complete",
      nom: "Validation",
      prenom: "API",
      school_year: "2026-2027",
      zone_scolaire: "A",
      levels: ["CE1", "CE2"],
      class_type: "multiniveau",
      working_days: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
    })
    .eq("id", linkData.profileId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  await setupCompleteTeacherProfile(dbClient, linkData.profileId);

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    email,
    password,
    userId,
    profileId: linkData.profileId,
    accessToken,
    cookieHeader,
    authClient,
    dbClient,
  };
}

export async function apiFetch(
  session: ApiTestSession,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Cookie", session.cookieHeader);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${session.baseUrl}${path}`, {
    ...init,
    headers,
  });
}

export async function readApiJson<T extends ApiJson>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  if (!response.ok) {
    const message =
      (typeof data.error === "string" && data.error) ||
      (typeof data.details === "string" && data.details) ||
      `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function reconnectApiSession(session: ApiTestSession): Promise<ApiTestSession> {
  await session.authClient.auth.signOut();

  const signIn = await session.authClient.auth.signInWithPassword({
    email: session.email,
    password: session.password,
  });
  const accessToken = signIn.data.session?.access_token;
  if (!accessToken) {
    throw new Error("Reconnexion impossible");
  }

  const linkResponse = await fetch(`${session.baseUrl}/api/auth/link-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      refreshToken: signIn.data.session?.refresh_token,
    }),
  });

  const linkData = (await linkResponse.json()) as { error?: string; profileId?: string };
  if (!linkResponse.ok || !linkData.profileId) {
    throw new Error(linkData.error ?? "Reliaison profil impossible");
  }

  const { supabaseUrl, supabaseAnonKey } = requireSupabaseConfig();
  const dbClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    ...session,
    accessToken,
    profileId: linkData.profileId,
    cookieHeader: buildCookieHeader(linkResponse, accessToken),
    dbClient,
  };
}

export async function logoutApiSession(session: ApiTestSession) {
  await apiFetch(session, "/api/auth/link-profile", { method: "DELETE" });
  await session.authClient.auth.signOut();
}

export async function cleanupApiTestSession(session: ApiTestSession) {
  if (!supabaseUrl || !serviceRoleKey) return;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await admin.from("teacher_profiles").delete().eq("id", session.profileId);
  await admin.auth.admin.deleteUser(session.userId);
}

export function fileFromBuffer(buffer: Buffer, fileName: string, mimeType: string): File {
  const blob = new Blob([buffer], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
}
