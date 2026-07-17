import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/supabase/auth-server";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";

export async function GET() {
  try {
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    const bundle = await loadTeacherProfileBundle();

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email: user.email ?? "",
      profileId: bundle?.profile.id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        authenticated: false,
        error: error instanceof Error ? error.message : "Session invalide",
      },
      { status: 401 },
    );
  }
}
