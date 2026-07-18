import { floraDb } from "@/lib/supabase/get-db";
import { IMPORT_CONFIG } from "./config";
import { documentAnalyzer } from "./DocumentAnalyzer";
import { failImportPipeline, importErrorToApiPayload } from "./import-error-diagnostics";
import type { ImportJob } from "./types";
import { notificationManager } from "./NotificationManager";

let processing = false;

function mapJob(row: Record<string, unknown>): ImportJob {
  return {
    id: String(row.id),
    documentId: String(row.document_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    status: String(row.status) as ImportJob["status"],
    queuePosition: Number(row.queue_position ?? 0),
    progress: Number(row.progress ?? 0),
    stageLabel: String(row.stage_label ?? ""),
    errorMessage: String(row.error_message ?? ""),
    paused: Boolean(row.paused),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function isDeferredJobReady(job: ImportJob): boolean {
  if (job.status !== "waiting_ai" || job.paused) return false;
  const retryAfter = job.metadata.geminiRetryAfter;
  if (typeof retryAfter !== "string" || !retryAfter) return false;
  return new Date(retryAfter).getTime() <= Date.now();
}

export class ImportQueue {
  async enqueue(documentId: string, sessionId?: string): Promise<ImportJob> {
    const { count } = await (await floraDb())
      .from("document_import_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "extracting", "ocr", "analyzing", "indexing", "waiting_ai"]);

    const queuePosition = (count ?? 0) + 1;

    const { data, error } = await (await floraDb())
      .from("document_import_jobs")
      .insert({
        document_id: documentId,
        session_id: sessionId ?? null,
        status: "queued",
        queue_position: queuePosition,
        progress: 0,
        stage_label: "En file d'attente…",
      })
      .select("*")
      .single();

    if (error || !data) {
      failImportPipeline(
        {
          step: "database_insert",
          table: "document_import_jobs",
          documentId,
          sessionId,
        },
        error ?? new Error("Insertion job impossible."),
      );
    }

    return mapJob(data);
  }

  async getJob(jobId: string): Promise<ImportJob | null> {
    const { data } = await (await floraDb())
      .from("document_import_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    return data ? mapJob(data) : null;
  }

  async getJobForDocument(documentId: string): Promise<ImportJob | null> {
    const { data } = await (await floraDb())
      .from("document_import_jobs")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data ? mapJob(data) : null;
  }

  async listActiveJobs(): Promise<ImportJob[]> {
    const { data } = await (await floraDb())
      .from("document_import_jobs")
      .select("*")
      .in("status", ["queued", "extracting", "ocr", "analyzing", "indexing", "paused", "waiting_ai"])
      .order("queue_position", { ascending: true });

    return (data ?? []).map(mapJob);
  }

  async pauseJob(jobId: string): Promise<void> {
    await (await floraDb())
      .from("document_import_jobs")
      .update({ paused: true, status: "paused", updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  async resumeJob(jobId: string): Promise<void> {
    await (await floraDb())
      .from("document_import_jobs")
      .update({ paused: false, status: "queued", updated_at: new Date().toISOString() })
      .eq("id", jobId);
    void this.processNext();
  }

  async cancelJob(jobId: string): Promise<void> {
    await (await floraDb())
      .from("document_import_jobs")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  async reorder(jobIdsInOrder: string[]): Promise<void> {
    const db = await floraDb();
    await Promise.all(
      jobIdsInOrder.map((jobId, index) =>
        db.from("document_import_jobs").update({ queue_position: index + 1 }).eq("id", jobId),
      ),
    );
  }

  async processDeferredReady(): Promise<void> {
    const { data: deferredJobs } = await (await floraDb())
      .from("document_import_jobs")
      .select("*")
      .eq("status", "waiting_ai")
      .eq("paused", false)
      .order("updated_at", { ascending: true })
      .limit(5);

    const ready = (deferredJobs ?? []).map(mapJob).find(isDeferredJobReady);
    if (!ready) return;

    await (await floraDb())
      .from("document_import_jobs")
      .update({
        status: "analyzing",
        stage_label: "Reprise automatique de l'analyse IA…",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ready.id);

    try {
      await documentAnalyzer.analyzeDocument(ready.documentId, ready);
    } catch (error) {
      const payload = importErrorToApiPayload(error);
      await (await floraDb())
        .from("document_import_jobs")
        .update({
          status: "failed",
          error_message: payload.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ready.id);

      await (await floraDb()).from("documents").update({ status: "error" }).eq("id", ready.documentId);

      await notificationManager.notify({
        documentId: ready.documentId,
        jobId: ready.id,
        type: "analysis_failed",
        message: payload.error,
      });
    }
  }

  async processNext(): Promise<void> {
    if (processing) return;
    processing = true;

    try {
      await this.processDeferredReady();

      const { data: running } = await (await floraDb())
        .from("document_import_jobs")
        .select("id")
        .in("status", ["extracting", "ocr", "analyzing", "indexing"])
        .limit(IMPORT_CONFIG.maxParallelJobs);

      if ((running?.length ?? 0) >= IMPORT_CONFIG.maxParallelJobs) return;

      const { data: nextJob } = await (await floraDb())
        .from("document_import_jobs")
        .select("*")
        .eq("status", "queued")
        .eq("paused", false)
        .order("queue_position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextJob) return;

      const job = mapJob(nextJob);

      await (await floraDb())
        .from("document_import_jobs")
        .update({
          status: "extracting",
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await notificationManager.notify({
        documentId: job.documentId,
        jobId: job.id,
        type: "analysis_started",
        message: "Analyse du document démarrée.",
      });

      try {
        await documentAnalyzer.analyzeDocument(job.documentId, job);
      } catch (error) {
        const payload = importErrorToApiPayload(error);
        const message = payload.error;
        await (await floraDb())
          .from("document_import_jobs")
          .update({
            status: "failed",
            error_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        await (await floraDb()).from("documents").update({ status: "error" }).eq("id", job.documentId);

        await notificationManager.notify({
          documentId: job.documentId,
          jobId: job.id,
          type: "analysis_failed",
          message,
        });
      }
    } finally {
      processing = false;
      void this.processNext();
    }
  }
}

export const importQueue = new ImportQueue();
