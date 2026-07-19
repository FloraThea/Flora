type EdtTracePayload = {
  userId?: string | null;
  profileId?: string | null;
  importId?: string | null;
  scheduleId?: string | null;
  status?: string;
  slotCount?: number;
  error?: string;
  fileName?: string;
  fileSize?: number;
};

export function edtImportTrace(step: string, payload: EdtTracePayload = {}): void {
  const parts = [
    step,
    payload.userId !== undefined ? `user_id=${payload.userId ?? "null"}` : null,
    payload.profileId !== undefined ? `profile_id=${payload.profileId ?? "null"}` : null,
    payload.importId !== undefined ? `import_id=${payload.importId ?? "null"}` : null,
    payload.scheduleId !== undefined ? `schedule_id=${payload.scheduleId ?? "null"}` : null,
    payload.status ? `status=${payload.status}` : null,
    payload.slotCount !== undefined ? `slots=${payload.slotCount}` : null,
    payload.fileName ? `file=${payload.fileName}` : null,
    payload.fileSize !== undefined ? `bytes=${payload.fileSize}` : null,
    payload.error ? `error=${payload.error}` : null,
  ].filter(Boolean);

  console.info(`[${step}] ${parts.slice(1).join(" ")}`.trim());
}
