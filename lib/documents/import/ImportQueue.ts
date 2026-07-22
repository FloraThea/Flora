import { floraDb } from "@/lib/supabase/get-db";
import { IMPORT_CONFIG } from "./config";
import { documentAnalyzer } from "./DocumentAnalyzer";
import { failImportPipeline, importErrorToApiPayload } from "./import-error-diagnostics";
import { isImportJobActivelyRunning, isImportJobStale } from "./import-queue-runner";
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

  async cancelForDocument(documentId: string): Promise<void> {
    const { data: jobs, error } = await (await floraDb())
      .from("document_import_jobs")
      .select("id")
      .eq("document_id", documentId)
      .in("status", ["queued", "extracting", "ocr", "analyzing", "indexing", "paused", "waiting_ai"]);

    if (error) throw error;

    for (const job of jobs ?? []) {
      await this.cancelJob(String(job.id));
    }
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

  async recoverStaleJobs(): Promise<number> {
    const { data: activeJobs } = await (await floraDb())
      .from("document_import_jobs")
      .select("*")
      .in("status", ["extracting", "ocr", "analyzing", "indexing"]);

    let recovered = 0;

    for (const row of activeJobs ?? []) {
      const job = mapJob(row);
      if (!isImportJobStale(job)) continue;

      const { data: documentRow } = await (await floraDb())
        .from("documents")
        .select("status, metadata")
        .eq("id", job.documentId)
        .maybeSingle();

      if (documentRow?.status === "analysed" && job.status === "indexing") {
        console.info("[import-queue] Reprise indexation job bloqué", {
          jobId: job.id,
          documentId: job.documentId,
        });
        try {
          await documentAnalyzer.resumeIndexingPhase(job.documentId, job);
          recovered += 1;
          continue;
        } catch (error) {
          console.error("[import-queue] Reprise indexation échouée", error);
        }
      }

      const checkpoint = (documentRow?.metadata as Record<string, unknown> | null)?.analysisCheckpoint;
      await (await floraDb())
        .from("document_import_jobs")
        .update({
          status: checkpoint ? "queued" : "failed",
          stage_label: checkpoint
            ? "Analyse interrompue — reprise automatique…"
            : "Analyse interrompue (délai dépassé).",
          error_message: checkpoint
            ? ""
            : "L'analyse a été interrompue par le serveur. Relancez l'import.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      recovered += 1;
    }

    return recovered;
  }

  /**
   * Exécute l'analyse d'un document jusqu'à complétion, attente IA ou échec.
   * À appeler depuis /api/documents/import/analyze (maxDuration 300s).
   */
  async processDocument(documentId: string, jobId?: string): Promise<ImportJob | null> {
    await this.recoverStaleJobs();

    let job =
      (jobId ? await this.getJob(jobId) : null) ??
      (await this.getJobForDocument(documentId));

    if (!job) {
      job = await this.enqueue(documentId);
    }

    if (job.status === "completed" || job.status === "cancelled") {
      return job;
    }

    if (job.status === "waiting_ai") {
      if (isDeferredJobReady(job)) {
        await this.runJob(job);
      }
      return (await this.getJob(job.id)) ?? job;
    }

    if (isImportJobActivelyRunning(job)) {
      return job;
    }

    if (job.status === "failed") {
      job = await this.enqueue(documentId);
    }

    if (job.status === "queued" || job.status === "paused" || isImportJobStale(job)) {
      if (job.status !== "queued") {
        await (await floraDb())
          .from("document_import_jobs")
          .update({ status: "queued", paused: false, updated_at: new Date().toISOString() })
          .eq("id", job.id);
        job = { ...job, status: "queued", paused: false };
      }
      await this.runJob(job);
    }

    return (await this.getJob(job.id)) ?? job;
  }

  private async runJob(job: ImportJob): Promise<void> {
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
      await (await floraDb())
        .from("document_import_jobs")
        .update({
          status: "failed",
          error_message: payload.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await (await floraDb()).from("documents").update({ status: "error" }).eq("id", job.documentId);

      await notificationManager.notify({
        documentId: job.documentId,
        jobId: job.id,
        type: "analysis_failed",
        message: payload.error,
      });
    }
  }

  async processNext(): Promise<void> {
    if (processing) return;
    processing = true;

    try {
      await this.recoverStaleJobs();
      await this.processDeferredReady();

      const { data: running } = await (await floraDb())
        .from("document_import_jobs")
        .select("id, status, updated_at")
        .in("status", ["extracting", "ocr", "analyzing", "indexing"]);

      const activeCount = (running ?? []).filter((row) =>
        isImportJobActivelyRunning(mapJob(row as Record<string, unknown>)),
      ).length;

      if (activeCount >= IMPORT_CONFIG.maxParallelJobs) return;

      const { data: nextJob } = await (await floraDb())
        .from("document_import_jobs")
        .select("*")
        .eq("status", "queued")
        .eq("paused", false)
        .order("queue_position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextJob) return;

      await this.runJob(mapJob(nextJob));
    } finally {
      processing = false;
      void this.processNext();
    }
  }
}

export const importQueue = new ImportQueue();
