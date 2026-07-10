import "server-only";

import { NextRequest } from "next/server";

export function isAdminActionAllowed(request: NextRequest): boolean {
  const secret = process.env.FLORA_ADMIN_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-flora-admin-secret")?.trim();
  const urlSecret = request.nextUrl.searchParams.get("secret")?.trim();
  return headerSecret === secret || urlSecret === secret;
}

export function getAdminAuthHint(): string | null {
  if (process.env.FLORA_ADMIN_SECRET?.trim()) {
    return "Définissez le secret dans l'en-tête x-flora-admin-secret pour appliquer les migrations.";
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return "Définissez FLORA_ADMIN_SECRET dans .env pour sécuriser l'application des migrations.";
}
