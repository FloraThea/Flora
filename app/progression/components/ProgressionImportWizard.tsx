"use client";

import { useCallback, useEffect, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { ImportBatchPanel } from "@/components/import/ImportBatchPanel";
import { ImportPreviewTable } from "@/components/import/ImportPreviewTable";
import {
  ImportMetadataForm,
  type ImportMetadataValues,
} from "@/components/pedagogical/PedagogicalModuleToolbar";
import { parseImportApiError } from "@/lib/import/import-api-errors";
import {
  inferMatiereFromTitle,
  inferSousMatiereFromTitle,
  normalizeMatiere,
} from "@/lib/pedagogical/subjects";
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
import { mergeProgrammationPages } from "@/lib/programming/import/merge-programmation-pages";
import { METHODE_OPTIONS, type ValidatedProgrammationOption } from "../types";

const MAPPING_FIELDS: ProgrammationColumnField[] = [
  "date",
  "day",
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
  "Sélection et téléversement",
  "Analyse IA",
  "Vérification",
  "Lier et sauvegarder",
] as const;

type ProgressionImportWizardProps = {
  programmations: ValidatedProgrammationOption[];
  defaultProgrammationId: string;
  defaultMethode: string;
  defaultMatiere?: string;
  defaultSousMatiere?: string;
  onComplete: (payload: ProgressionPayload) => void;
  onClose: () => void;
};

async function analyzeProgressionFile(file: File): Promise<ParsedProgressionImport> {
  const formData = new FormData();
  formData.append("action", "analyze");
  formData.append("file", file);
  const response = await fetch("/api/progression/import", { method: "POST", body: formData });
  const data = (await response.json()) as { parsed?: ParsedProgressionImport; error?: string; details?: string };
  if (!response.ok) {
    throw new Error(parseImportApiError(data, "Analyse impossible."));
  }
  if (!data.parsed) throw new Error("Analyse sans résultat.");
  return data.parsed;
}

async function uploadProgressionFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("action", "upload");
  formData.append("file", file);
  const response = await fetch("/api/progression/import", { method: "POST", body: formData });
  const data = (await response.json()) as { storagePath?: string; error?: string; details?: string };
  if (!response.ok) {
    throw new Error(parseImportApiError(data, "Téléversement impossible."));
  }
  return data.storagePath ?? "";
}

export function ProgressionImportWizard({
  programmations,
  defaultProgrammationId,
  defaultMethode,
  defaultMatiere = "",
  defaultSousMatiere = "",
  onComplete,
  onClose,
}: ProgressionImportWizardProps) {
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<ParsedProgressionImport | null>(null);
  const [session, setSession] = useState<ProgressionImportSession | null>(null);
  const [programmationId, setProgrammationId] = useState(defaultProgrammationId);
  const [methode, setMethode] = useState(defaultMethode);
  const [title, setTitle] = useState("");
  const [importMetadata, setImportMetadata] = useState<ImportMetadataValues>({
    title: "",
    matiere: "",
    sousMatiere: "",
    niveau: "",
    periode: "",
    documentType: "Progression",
  });
  const [storagePaths, setStoragePaths] = useState<string[]>([]);
  const [sourceFileNames, setSourceFileNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<
    Partial<Record<ProgrammationColumnField, number>>
  >({});

  useEffect(() => {
    if (!defaultMatiere && !defaultSousMatiere) return;
    setImportMetadata((current) => ({
      ...current,
      matiere: defaultMatiere || current.matiere,
      sousMatiere: defaultSousMatiere || current.sousMatiere,
    }));
  }, [defaultMatiere, defaultSousMatiere]);

  const handleBatchAnalyze = useCallback(
    async (input: {
      items: Array<{ clientId: string; file: File }>;
      mergeMode: "single_document" | "multiple_documents";
      setFileStatus: (
        clientId: string,
        status: "pending" | "uploading" | "uploaded" | "analyzing" | "analyzed" | "error",
        error?: string,
      ) => void;
    }) => {
      setError(null);
      const batchId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `batch-${Date.now()}`;

      const pageResults: Array<{
        pageOrder: number;
        fileId: string;
        fileName: string;
        storagePath?: string;
        parsed: ParsedProgressionImport;
      }> = [];

      const paths: string[] = [];
      const names: string[] = [];

      for (let index = 0; index < input.items.length; index += 1) {
        const { clientId, file } = input.items[index]!;

        try {
          input.setFileStatus(clientId, "uploading");
          const storagePath = await uploadProgressionFile(file).catch(() => "");
          if (storagePath) paths.push(storagePath);
          names.push(file.name);
          input.setFileStatus(clientId, "analyzing");

          const pageParsed = await analyzeProgressionFile(file);
          pageResults.push({
            pageOrder: index + 1,
            fileId: `page-${index + 1}`,
            fileName: file.name,
            storagePath: storagePath || undefined,
            parsed: pageParsed,
          });
          input.setFileStatus(clientId, "analyzed");
        } catch (fileError) {
          input.setFileStatus(
            clientId,
            "error",
            fileError instanceof Error ? fileError.message : "Erreur",
          );
          throw fileError;
        }
      }

      let merged: ParsedProgressionImport;
      if (input.mergeMode === "single_document" || input.items.length === 1) {
        merged = mergeProgrammationPages(batchId, pageResults) as ParsedProgressionImport;
      } else {
        const allRows = pageResults.flatMap((page) => page.parsed.rows);
        const primary = pageResults[0]?.parsed;
        merged = {
          ...(primary ?? pageResults[0]!.parsed),
          rows: allRows,
          rowCount: allRows.length,
          warnings: pageResults.flatMap((page) =>
            page.parsed.warnings.map((warning) => `[${page.fileName}] ${warning}`),
          ),
        };
      }

      setParsed(merged);
      setColumnMapping(merged.columnMapping ?? {});
      setTitle(`Import progression — ${merged.discipline || "Flora"}`);
      const inferredMatiere = normalizeMatiere(merged.discipline || inferMatiereFromTitle(merged.fileName));
      setImportMetadata((current) => ({
        ...current,
        title: `Import progression — ${merged.discipline || "Flora"}`,
        matiere: inferredMatiere,
        sousMatiere: inferSousMatiereFromTitle(merged.fileName, inferredMatiere),
        documentType: "Progression",
      }));
      setStoragePaths(paths);
      setSourceFileNames(names);
      setStep(1);
    },
    [],
  );

  const runPreview = useCallback(async () => {
    if (!parsed) return;

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
          title: importMetadata.title || title,
          matiere: importMetadata.matiere,
          sousMatiere: importMetadata.sousMatiere,
          niveau: importMetadata.niveau,
          periode: importMetadata.periode,
        }),
      });
      const data = (await response.json()) as {
        session?: ProgressionImportSession;
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(parseImportApiError(data, "Prévisualisation impossible."));
      }

      setSession(data.session ?? null);
      setStep(3);
    } catch (previewError) {
      setError(
        previewError instanceof Error ? previewError.message : "Prévisualisation impossible.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [importMetadata, parsed, programmationId, methode, title]);

  const runSave = useCallback(async () => {
    if (!parsed) return;
    if (!importMetadata.matiere.trim()) {
      setError("La matière est obligatoire avant l'enregistrement.");
      return;
    }

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
          title: importMetadata.title || title,
          matiere: importMetadata.matiere,
          sousMatiere: importMetadata.sousMatiere,
          niveau: importMetadata.niveau,
          periode: importMetadata.periode,
          sourceStoragePath: storagePaths[0] ?? "",
          sourceFileName: sourceFileNames.join(", "),
        }),
      });
      const data = (await response.json()) as ProgressionPayload & {
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        throw new Error(parseImportApiError(data, "Sauvegarde impossible."));
      }

      onComplete(data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sauvegarde impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [importMetadata, parsed, programmationId, methode, title, storagePaths, sourceFileNames, onComplete]);

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

  const totalRows = session?.tabs.reduce((sum, tab) => sum + tab.rows.length, 0) ?? 0;

  return (
    <FloraCard padding="lg" accent="rose" className="w-full max-w-full space-y-6 overflow-x-hidden box-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
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
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm text-[#b88989] break-words">
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <ImportBatchPanel
          module="progression"
          analyzeButtonLabel="Analyser la progression"
          singleDocumentLabel="Plusieurs pages d'une même progression"
          multipleDocumentsLabel="Plusieurs progressions différentes"
          onAnalyze={handleBatchAnalyze}
          onError={setError}
        />
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
                <li key={warning} className="break-words">
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}

          {parsed.rows.length > 0 ? (
            <ImportPreviewTable rows={parsed.rows} fileName={parsed.fileName} />
          ) : parsed.previewRows.length > 0 ? (
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
              Continuer vers la vérification
            </FloraButton>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-sm font-light text-flora-text-muted">
            Vérifiez et corrigez les métadonnées avant l&apos;enregistrement. La matière validée ici
            sera utilisée pour le classement par onglets.
          </p>

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

          <ImportMetadataForm
            values={importMetadata}
            onChange={(key, value) => {
              setImportMetadata((current) => ({ ...current, [key]: value }));
              if (key === "title") setTitle(value);
            }}
          />

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
            <FloraButton onClick={() => void runPreview()} disabled={isLoading}>
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
            {session.programmationId
              ? " et liées à la programmation sélectionnée"
              : " comme progression indépendante"}
            .
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
