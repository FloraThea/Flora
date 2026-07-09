"use client";

import { useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraProgressBar } from "@/components/ui/FloraProgressBar";
import { HOURS_108_CATEGORIES, formatMinutesAsHours } from "@/lib/agenda/hours-108";
import type { Hours108Dashboard } from "@/lib/agenda/types";
import { accentClasses } from "@/lib/theme";
import { cn } from "@/lib/cn";

type Hours108PanelProps = {
  dashboard: Hours108Dashboard | null;
  isLoading: boolean;
  onRefresh: () => void;
};

export function Hours108Panel({ dashboard, isLoading, onRefresh }: Hours108PanelProps) {
  const [form, setForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    categoryCode: "108_apc",
    durationMinutes: 60,
    description: "",
    location: "",
    comments: "",
    attachmentUrl: "",
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSaving(true);
    setMessage(null);
    try {
      let attachmentUrl = form.attachmentUrl;

      if (attachmentFile) {
        const uploadData = new FormData();
        uploadData.append("file", attachmentFile);
        const uploadResponse = await fetch("/api/agenda/108h/upload", {
          method: "POST",
          body: uploadData,
        });
        const uploadResult = (await uploadResponse.json()) as {
          attachmentUrl?: string;
          error?: string;
        };
        if (!uploadResponse.ok) {
          throw new Error(uploadResult.error || "Upload pièce jointe impossible.");
        }
        attachmentUrl = uploadResult.attachmentUrl ?? "";
      }

      const response = await fetch("/api/agenda/108h", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attachmentUrl }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Saisie impossible.");
      setMessage("Activité enregistrée.");
      setForm((current) => ({
        ...current,
        description: "",
        comments: "",
        attachmentUrl: "",
      }));
      setAttachmentFile(null);
      onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saisie impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !dashboard) {
    return (
      <FloraCard padding="lg">
        <p className="text-sm font-light text-flora-text-subtle">Chargement du suivi 108h…</p>
      </FloraCard>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <FloraCard padding="lg" accent="sage" className="xl:col-span-2">
        <h2 className="font-serif text-2xl font-medium">Suivi des 108 heures</h2>
        <p className="mt-2 text-sm font-light text-flora-text-subtle">
          Quotité {dashboard.workQuotaLabel} · Année {dashboard.schoolYear}
        </p>

        <div className="mt-6">
          <FloraProgressBar value={dashboard.percentComplete} accent="sage" showLabel />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Prévues" value={formatMinutesAsHours(dashboard.totalPlannedMinutes)} />
            <Stat label="Réalisées" value={formatMinutesAsHours(dashboard.totalCompletedMinutes)} />
            <Stat label="Restantes" value={formatMinutesAsHours(dashboard.totalRemainingMinutes)} />
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          {dashboard.categories.map((category) => {
            const styles = accentClasses[category.color];
            return (
              <div key={category.categoryCode} className="rounded-2xl bg-white/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("text-sm font-medium", styles.text)}>{category.label}</p>
                  <span className="text-xs text-flora-text-subtle">{category.percentComplete} %</span>
                </div>
                <FloraProgressBar
                  className="mt-3"
                  value={category.percentComplete}
                  accent={category.color}
                  size="sm"
                />
                <p className="mt-2 text-xs font-light text-flora-text-subtle">
                  {formatMinutesAsHours(category.completedMinutes)} /{" "}
                  {formatMinutesAsHours(category.plannedMinutes)} · Reste{" "}
                  {formatMinutesAsHours(category.remainingMinutes)}
                </p>
              </div>
            );
          })}
        </div>

        {dashboard.monthlyTrend.length > 0 ? (
          <div className="mt-8">
            <h3 className="text-sm font-medium text-flora-text-muted">Évolution mensuelle</h3>
            <div className="mt-3 flex items-end gap-2">
              {dashboard.monthlyTrend.map((point) => {
                const max = Math.max(...dashboard.monthlyTrend.map((item) => item.minutes), 1);
                const height = Math.max(8, Math.round((point.minutes / max) * 80));
                return (
                  <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-lg bg-sauge/50"
                      style={{ height }}
                      title={formatMinutesAsHours(point.minutes)}
                    />
                    <span className="text-[10px] text-flora-text-subtle">{point.month.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </FloraCard>

      <FloraCard padding="lg" accent="lavender">
        <h3 className="font-serif text-xl font-medium">Enregistrer une activité</h3>
        <div className="mt-4 grid gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">Date</span>
            <input
              type="date"
              value={form.entryDate}
              onChange={(e) => setForm((c) => ({ ...c, entryDate: e.target.value }))}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">Catégorie</span>
            <select
              value={form.categoryCode}
              onChange={(e) => setForm((c) => ({ ...c, categoryCode: e.target.value }))}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2"
            >
              {HOURS_108_CATEGORIES.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Durée (minutes)
            </span>
            <input
              type="number"
              min={15}
              step={15}
              value={form.durationMinutes}
              onChange={(e) =>
                setForm((c) => ({ ...c, durationMinutes: Number(e.target.value) || 60 }))
              }
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Description
            </span>
            <input
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">Lieu</span>
            <input
              value={form.location}
              onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Commentaires
            </span>
            <textarea
              value={form.comments}
              onChange={(e) => setForm((c) => ({ ...c, comments: e.target.value }))}
              className="min-h-20 w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Pièce jointe
            </span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-sauge/20 file:px-3 file:py-1 file:text-xs"
            />
            {attachmentFile ? (
              <span className="mt-1 block text-xs font-light text-flora-text-subtle">{attachmentFile.name}</span>
            ) : null}
          </label>
          <FloraButton onClick={() => void handleSubmit()} disabled={isSaving}>
            {isSaving ? "Enregistrement…" : "Enregistrer"}
          </FloraButton>
          {message ? <p className="text-sm font-light text-flora-text-subtle">{message}</p> : null}
        </div>
      </FloraCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/45 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-flora-text-subtle">{label}</p>
      <p className="mt-1 text-lg font-light text-flora-text">{value}</p>
    </div>
  );
}
