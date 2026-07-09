import { supabase } from "@/lib/supabase";
import { IMPORT_CONFIG } from "./config";
import type { ImportNotification } from "./types";

export class NotificationManager {
  async notify(input: {
    documentId?: string;
    jobId?: string;
    type: string;
    message: string;
  }): Promise<ImportNotification | null> {
    if (!IMPORT_CONFIG.notifications.enabled) return null;

    const { data, error } = await supabase
      .from("document_import_notifications")
      .insert({
        document_id: input.documentId ?? null,
        job_id: input.jobId ?? null,
        notification_type: input.type,
        message: input.message,
      })
      .select("*")
      .single();

    if (error || !data) return null;

    return {
      id: String(data.id),
      documentId: data.document_id ? String(data.document_id) : null,
      jobId: data.job_id ? String(data.job_id) : null,
      type: String(data.notification_type),
      message: String(data.message),
      read: Boolean(data.read),
      createdAt: String(data.created_at),
    };
  }

  async listUnread(limit = 20): Promise<ImportNotification[]> {
    const { data } = await supabase
      .from("document_import_notifications")
      .select("*")
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((row) => ({
      id: String(row.id),
      documentId: row.document_id ? String(row.document_id) : null,
      jobId: row.job_id ? String(row.job_id) : null,
      type: String(row.notification_type),
      message: String(row.message),
      read: Boolean(row.read),
      createdAt: String(row.created_at),
    }));
  }

  async markRead(notificationId: string): Promise<void> {
    await supabase
      .from("document_import_notifications")
      .update({ read: true })
      .eq("id", notificationId);
  }
}

export const notificationManager = new NotificationManager();
