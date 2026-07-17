type AuditLevel = "request" | "success" | "error";

type AuditBase = {
  module: string;
  table: string;
  action: string;
};

type AuditRequest = AuditBase & {
  userId?: string | null;
  profileId?: string | null;
  schoolYear?: string | null;
};

type AuditSuccess = AuditBase & {
  count?: number;
};

type AuditError = AuditBase & {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function log(level: AuditLevel, payload: Record<string, unknown>): void {
  const prefix = `[SupabaseAudit] ${level}`;
  if (level === "error") {
    console.error(prefix, payload);
    return;
  }
  console.log(prefix, payload);
}

export function logSupabaseAuditRequest(input: AuditRequest): void {
  log("request", {
    module: input.module,
    table: input.table,
    action: input.action,
    userId: input.userId ?? undefined,
    profileId: input.profileId ?? undefined,
    schoolYear: input.schoolYear ?? undefined,
  });
}

export function logSupabaseAuditSuccess(input: AuditSuccess): void {
  log("success", {
    module: input.module,
    table: input.table,
    action: input.action,
    count: input.count,
  });
}

export function logSupabaseAuditError(input: AuditError): void {
  log("error", {
    module: input.module,
    table: input.table,
    action: input.action,
    code: input.code,
    message: input.message,
    details: input.details,
    hint: input.hint,
  });
}

export function logSupabaseResult(
  input: AuditRequest,
  result: { data?: unknown[] | unknown | null; error?: { code?: string; message?: string; details?: string; hint?: string } | null },
): void {
  if (result.error) {
    logSupabaseAuditError({
      module: input.module,
      table: input.table,
      action: input.action,
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
      hint: result.error.hint,
    });
    return;
  }

  const count = Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0;
  logSupabaseAuditSuccess({
    module: input.module,
    table: input.table,
    action: input.action,
    count,
  });
}
