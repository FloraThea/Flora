export type SupabaseErrorDetails = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export function isSupabaseError(error: unknown): error is SupabaseErrorDetails {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as SupabaseErrorDetails).message === "string"
  );
}

export function getSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (isSupabaseError(error)) {
    const parts = [error.message];
    if (error.code) parts.push(`(${error.code})`);
    if (error.details) parts.push(`— ${error.details}`);
    return parts.join(" ");
  }

  return fallback;
}

export function serializeSupabaseError(error: unknown): SupabaseErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: "name" in error ? String(error.name) : undefined,
    };
  }

  if (isSupabaseError(error)) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    };
  }

  return { message: String(error) };
}
