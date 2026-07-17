import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { linkTeacherProfileToAuthUser } from "@/lib/supabase/auth-server";

const TOKEN_COOKIE = "flora-auth-token";

function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("Supabase non configuré.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { accessToken?: string; refreshToken?: string };
    const accessToken = body.accessToken?.trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token d'accès requis." }, { status: 400 });
    }

    const client = createAuthClient();
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json({ error: "Session invalide." }, { status: 401 });
    }

    const profileId = await linkTeacherProfileToAuthUser(data.user.id);

    const response = NextResponse.json({
      ok: true,
      profileId,
      userId: data.user.id,
      email: data.user.email ?? "",
    });

    response.cookies.set(TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    if (body.refreshToken?.trim()) {
      response.cookies.set("flora-refresh-token", body.refreshToken.trim(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Liaison profil impossible." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(TOKEN_COOKIE);
  response.cookies.delete("flora-refresh-token");
  return response;
}
