"use client";

import { useCallback, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraBadge } from "@/components/ui/FloraBadge";
import type { ProgressionPayload } from "@/lib/progression/types";
import type {
  ParsedProgressionImport,
  ProgressionImportSession,
  ProgrammationColumnField,
} from "@/lib/progression/import/types";
import {
  applyProgrammationColumnMapping,
  COLUMN_FIELD_LABELS,
} from "@/lib/programming/import/grid-parser";
import { getFormatsAcceptesLabel, getModuleAcceptAttribute } from "@/lib/import/accepted-formats";
import { METHODE_OPTIONS, type ValidatedProgrammationOption } from "../types";

const MAPPING_FIELDS: ProgrammationColumnField[] = [
  "period",
  "week",
  "discipline",
  "sequence",
  "seance",
  "objectif",
  "competence",
  "deroulement",
  "materiel",
];

const STEPS = [
  "Importer le fichier",
  "Analyser la progression",
  "Lier la programmation",
  "Valider et sauvegarder",
] as const;

type ProgressionImportWizardProps = {
  programmations: ValidatedProgrammationOption[];
  defaultProgrammationId: string;
  defaultMethode: string;
  onComplete: (payload: ProgressionPayload) => void;
  onClose: () => void;
};

export function ProgressionImportWizard({
  programmations,
  defaultProgrammationId,
  defaultMethode,
  onComplete,
  onClose,
}: ProgressionImportWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedProgressionImport | null>(null);
  const [session, setSession] = useState<ProgressionImportSession | null>(null);
  const [programmationId, setProgrammationId] = useState(defaultProgrammationId);
  const [methode, setMethode] = useState(defaultMethode);
  const [title, setTitle] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<
    Partial<Record<ProgrammationColumnField, number>>
  >({});

  const runAnalyze = useCallback(async () => {
    if (!file) {
      setError("Choisissez un fichier Excel, PDF ou JPG.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const uploadForm = new FormData();
      uploadForm.append("action", "upload");
      uploadForm.append("file", file);
      const uploadResponse = await fetch("/api/progression/import", {
        method: "POST",
        body: uploadForm,
      });
      const uploadData = (await uploadResponse.json()) as {
        storagePath?: string;
        error?: string;
      };
      if (uploadResponse.ok && uploadData.storagePath) {
        setStoragePath(uploadData.storagePath);
      }

      const analyzeForm = new FormData();
      analyzeForm.append("action", "analyze");
      analyzeForm.append("file", file);
      const response = await fetch("/api/progression/import", {
        method: "POST",
        body: analyzeForm,
      });
      const data = (await response.json()) as {
        parsed?: ParsedProgressionImport;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error || "Analyse impossible.");

      setParsed(data.parsed ?? null);
      setColumnMapping(data.parsed?.columnMapping ?? {});
      setTitle(`Import progression — ${data.parsed?.discipline || "Flora"}`);
      setStep(1);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Analyse impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  const runPreview = useCallback(async () => {
    if (!parsed || !programmationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/progression/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          parsed,
          programmationId: programmationId || null,
          methode,
          title,
        }),
      });
      const data = (await response.json()) as {
        session?: ProgressionImportSession;
        error?: string;
      };

      if (!response.ok) throw new Error(data.error || "Prévisualisation impossible.");

      setSession(data.session ?? null);
      setStep(3);
    } catch (previewError) {
      setError(
        previewError instanceof Error ? previewError.message : "Prévisualisation impossible.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [parsed, programmationId, methode, title]);

  const runSave = useCallback(async () => {
    if (!parsed || !programmationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/progression/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          parsed,
          programmationId: programmationId || null,
          methode,
          title,
          sourceStoragePath: storagePath,
          sourceFileName: file?.name,
        }),
      });
      const data = (await response.json()) as ProgressionPayload & { error?: string };

      if (!response.ok) throw new Error(data.error || "Sauvegarde impossible.");

      onComplete(data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sauvegarde impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [parsed, programmationId, methode, title, storagePath, file?.name, onComplete]);

  function applyColumnMapping() {
    if (!parsed) return;
    const updated = applyProgrammationColumnMapping(
      { ...parsed, format: parsed.format === "image" ? "text" : parsed.format },
      columnMapping,
    );
    setParsed({ ...updated, format: parsed.format });
    setColumnMapping(updated.columnMapping ?? columnMapping);
  }

  function updateColumnMapping(field: ProgrammationColumnField, columnIndex: number | "") {
    setColumnMapping((current) => {
      const next = { ...current };
      if (columnIndex === "") {
        delete next[field];
      } else {
        next[field] = columnIndex;
      }
      return next;
    });
  }

  const selectedProgrammation = programmations.find((item) => item.id === programmationId);
  const totalRows = session?.tabs.reduce((sum, tab) => sum + tab.rows.length, 0) ?? 0;

  return (
    <FloraCard padding="lg" accent="rose" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl font-medium">Importer une progression</h3>
          <p className="mt-1 text-sm font-light text-flora-text-subtle">
            Étape {step + 1} / {STEPS.length} — {STEPS[step]}
          </p>
        </div>
        <FloraButton variant="ghost" onClick={onClose}>
          Fermer
        </FloraButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <FloraBadge key={label} accent={index === step ? "sage" : "cream"}>
            {index + 1}. {label}
          </FloraBadge>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm text-[#b88989]">{error}</p>
      ) : null}

      {step === 0 ? (
        <div className="grid gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Fichier (Excel, PDF, JPG)
            </span>
            <input
              type="file"
              accept={getModuleAcceptAttribute("progression")}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            />
          </label>
          <p className="text-sm font-light text-flora-text-muted">
            {getFormatsAcceptesLabel("progression")}. Les photos sont analysées par OCR.
          </p>
          <FloraButton onClick={() => void runAnalyze()} disabled={isLoading || !file}>
            {isLoading ? "Analyse en cours…" : "Analyser le fichier"}
          </FloraButton>
        </div>
      ) : null}

      {step === 1 && parsed ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <FloraBadge accent="cream">{parsed.format.toUpperCase()}</FloraBadge>
            <FloraBadge accent="lavender">{parsed.rowCount} lignes détectées</FloraBadge>
          </div>

          {parsed.warnings.length > 0 ? (
            <ul className="space-y-1 text-sm font-light text-flora-text-muted">
              {parsed.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {parsed.previewRows.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/50 p-3">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr>
                    {parsed.columns.map((column) => (
                      <th key={column} className="px-2 py-1 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.previewRows.map((row, rowIndex) => (
                    <tr key={`preview-${rowIndex}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${rowIndex}-${cellIndex}`} className="px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="max-h-48 overflow-auto rounded-2xl bg-white/50 p-3 text-xs font-light text-flora-text-muted">
              {parsed.extractedTextPreview || "Aucun aperçu disponible."}
            </pre>
          )}

          {parsed.needsColumnMapping && parsed.columns.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {MAPPING_FIELDS.map((field) => (
                <label key={field} className="block text-sm">
                  <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
                    {COLUMN_FIELD_LABELS[field]}
                  </span>
                  <select
                    value={columnMapping[field] ?? ""}
                    onChange={(event) =>
                      updateColumnMapping(
                        field,
                        event.target.value === "" ? "" : Number(event.target.value),
                      )
                    }
                    className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {parsed.columns.map((column, index) => (
                      <option key={`${field}-${column}`} value={index}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <div className="md:col-span-2">
                <FloraButton variant="secondary" onClick={applyColumnMapping}>
                  Appliquer le mapping
                </FloraButton>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <FloraButton variant="secondary" onClick={() => setStep(0)}>
              Retour
            </FloraButton>
            <FloraButton onClick={() => setStep(2)} disabled={parsed.rowCount === 0}>
              Continuer
            </FloraButton>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Programmation associée (facultatif)
            </span>
            <select
              value={programmationId}
              onChange={(event) => setProgrammationId(event.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            >
              <option value="">Aucune — progression indépendante</option>
              {programmations.map((programmation) => (
                <option key={programmation.id} value={programmation.id}>
                  {programmation.title} — {programmation.school_year} ({programmation.matiere})
                </option>
              ))}
            </select>
          </label>

          {!programmationId ? (
            <p className="text-sm font-light text-flora-text-muted">
              Programmation associée : aucune. Vous pourrez lier ce document plus tard.
            </p>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Titre de la progression
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Méthode pédagogique
            </span>
            <select
              value={methode}
              onChange={(event) => setMethode(event.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            >
              {METHODE_OPTIONS.map((option) => (
                <option key={option || "inherit"} value={option}>
                  {option || "Hériter de la programmation"}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3">
            <FloraButton variant="secondary" onClick={() => setStep(1)}>
              Retour
            </FloraButton>
            <FloraButton
              onClick={() => void runPreview()}
              disabled={isLoading}
            >
              {isLoading ? "Préparation…" : "Prévisualiser"}
            </FloraButton>
          </div>
        </div>
      ) : null}

      {step === 3 && session ? (
        <div className="space-y-4">
          <p className="text-sm font-light text-flora-text-muted">
            {totalRows} séances réparties sur {session.tabs.length} onglet
            {session.tabs.length > 1 ? "s" : ""} seront importées
            {session.programmationId ? " et liées à la programmation sélectionnée" : " comme progression indépendante"}.
          </p>

          <ul className="space-y-2 text-sm font-light text-flora-text-muted">
            {session.tabs.map((tab) => (
              <li key={tab.subjectKey}>
                {tab.subSubjectLabel || tab.subjectLabel} — {tab.rows.length} séances
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-3">
            <FloraButton variant="secondary" onClick={() => setStep(2)}>
              Retour
            </FloraButton>
            <FloraButton onClick={() => void runSave()} disabled={isLoading}>
              {isLoading ? "Sauvegarde…" : "Valider et sauvegarder"}
            </FloraButton>
          </div>
        </div>
      ) : null}
    </FloraCard>
  );
}
