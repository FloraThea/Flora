"use client";

import { useCallback, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { ImportBatchPanel } from "@/components/import/ImportBatchPanel";
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
import type { SeancePayload } from "@/lib/seances/types";
import type { ParsedSeanceImport, SeanceImportSession } from "@/lib/seances/import/types";

const STEPS = ["Téléversement", "Analyse", "Vérification IA", "Liaisons et sauvegarde"] as const;

type SeanceImportWizardProps = {
  defaultMatiere?: string;
  defaultSousMatiere?: string;
  onComplete: (payload: { seances: SeancePayload[] }) => void;
  onClose: () => void;
};

async function analyzeSeanceFile(file: File): Promise<ParsedSeanceImport> {
  const formData = new FormData();
  formData.append("action", "analyze");
  formData.append("file", file);
  const response = await fetch("/api/seances/import", { method: "POST", body: formData });
  const data = (await response.json()) as { parsed?: ParsedSeanceImport; error?: string; details?: string };
  if (!response.ok) throw new Error(parseImportApiError(data, "Analyse impossible."));
  if (!data.parsed) throw new Error("Analyse sans résultat.");
  return data.parsed;
}

async function uploadSeanceFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("action", "upload");
  formData.append("file", file);
  const response = await fetch("/api/seances/import", { method: "POST", body: formData });
  const data = (await response.json()) as { storagePath?: string; error?: string; details?: string };
  if (!response.ok) throw new Error(parseImportApiError(data, "Téléversement impossible."));
  return data.storagePath ?? "";
}

export function SeanceImportWizard({
  defaultMatiere = "",
  defaultSousMatiere = "",
  onComplete,
  onClose,
}: SeanceImportWizardProps) {
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<ParsedSeanceImport | null>(null);
  const [session, setSession] = useState<SeanceImportSession | null>(null);
  const [importMetadata, setImportMetadata] = useState<ImportMetadataValues>({
    title: "",
    matiere: defaultMatiere,
    sousMatiere: defaultSousMatiere,
    niveau: "",
    periode: "",
    documentType: "Séance",
  });
  const [storagePath, setStoragePath] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSequenceSessionId, setSelectedSequenceSessionId] = useState("");

  const sessionCount =
    (parsed?.standaloneSessions.length ?? 0) +
    (parsed?.sequences.reduce((sum, sequence) => sum + sequence.sessions.length, 0) ?? 0);

  const handleBatchAnalyze = useCallback(
    async (input: {
      items: Array<{ clientId: string; file: File }>;
      setFileStatus: (
        clientId: string,
        status: "pending" | "uploading" | "uploaded" | "analyzing" | "analyzed" | "error",
        err?: string,
      ) => void;
    }) => {
      setError(null);
      const file = input.items[0]?.file;
      if (!file) return;

      input.setFileStatus(input.items[0]!.clientId, "uploading");
      const path = await uploadSeanceFile(file).catch(() => "");
      setStoragePath(path);
      setSourceFileName(file.name);
      input.setFileStatus(input.items[0]!.clientId, "analyzing");

      const analyzed = await analyzeSeanceFile(file);
      setParsed(analyzed);
      const inferredMatiere = normalizeMatiere(inferMatiereFromTitle(file.name));
      setImportMetadata((current) => ({
        ...current,
        title: analyzed.standaloneSessions[0]?.title.value || `Import séances — ${file.name}`,
        matiere: inferredMatiere || current.matiere,
        sousMatiere: inferSousMatiereFromTitle(file.name, inferredMatiere) || current.sousMatiere,
      }));
      input.setFileStatus(input.items[0]!.clientId, "analyzed");
      setStep(1);
    },
    [],
  );

  const runPreview = useCallback(async () => {
    if (!parsed) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/seances/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          parsed,
          title: importMetadata.title,
          matiere: importMetadata.matiere,
          sousMatiere: importMetadata.sousMatiere,
          niveau: importMetadata.niveau,
          periodNumber: Number(importMetadata.periode) || undefined,
        }),
      });
      const data = (await response.json()) as { session?: SeanceImportSession; error?: string; details?: string };
      if (!response.ok) throw new Error(parseImportApiError(data, "Prévisualisation impossible."));
      setSession(data.session ?? null);
      setStep(3);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Prévisualisation impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [importMetadata, parsed]);

  const runSave = useCallback(async () => {
    if (!parsed || !session) return;
    if (!importMetadata.matiere.trim()) {
      setError("La matière est obligatoire.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const selected = session.linkSuggestions.sequenceSessions.find(
        (item) => item.targetId === selectedSequenceSessionId,
      );
      const response = await fetch("/api/seances/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          parsed,
          title: importMetadata.title,
          matiere: importMetadata.matiere,
          sousMatiere: importMetadata.sousMatiere,
          niveau: importMetadata.niveau,
          periodNumber: Number(importMetadata.periode) || undefined,
          sourceStoragePath: storagePath,
          sourceFileName,
          selectedLinks: session.drafts.map((_, index) => ({
            seanceIndex: index,
            sequenceSessionId: selected?.targetId ?? null,
            sequenceId: selected ? session.linkSuggestions.sequences[0]?.targetId ?? null : null,
          })),
        }),
      });
      const data = (await response.json()) as { seances?: SeancePayload[]; error?: string; details?: string };
      if (!response.ok) throw new Error(parseImportApiError(data, "Sauvegarde impossible."));
      onComplete({ seances: data.seances ?? [] });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sauvegarde impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [importMetadata, parsed, session, selectedSequenceSessionId, sourceFileName, storagePath, onComplete]);

  const summary = session?.summary;

  return (
    <FloraCard padding="lg" accent="rose" className="w-full max-w-full space-y-6 overflow-x-hidden box-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl font-medium">Importer des séances</h3>
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
          <FloraBadge key={label} accent={index === step ? "rose" : "cream"}>
            {index + 1}. {label}
          </FloraBadge>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm text-[#b88989] break-words">{error}</p>
      ) : null}

      {step === 0 ? (
        <ImportBatchPanel
          module="seance"
          analyzeButtonLabel="Analyser les séances"
          singleDocumentLabel="Un document contenant une ou plusieurs séances"
          multipleDocumentsLabel="Plusieurs documents de séances"
          onAnalyze={handleBatchAnalyze}
          onError={setError}
        />
      ) : null}

      {step === 1 && parsed ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <FloraBadge accent="cream">{sessionCount} séance(s)</FloraBadge>
            <FloraBadge accent="sage">Confiance {(parsed.confidence * 100).toFixed(0)} %</FloraBadge>
          </div>
          <ul className="space-y-2 text-sm">
            {parsed.standaloneSessions.map((seance, index) => (
              <li key={`standalone-${index}`} className="rounded-2xl bg-white/50 px-4 py-3">
                <strong>{seance.title.value}</strong>
                {seance.uncertainFields.length > 0 ? (
                  <span className="block text-xs text-amber-700">
                    Incertain : {seance.uncertainFields.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <FloraButton variant="secondary" onClick={() => setStep(0)}>
              Retour
            </FloraButton>
            <FloraButton onClick={() => setStep(2)} disabled={sessionCount === 0}>
              Continuer
            </FloraButton>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <ImportMetadataForm
            values={importMetadata}
            onChange={(key, value) => setImportMetadata((current) => ({ ...current, [key]: value }))}
          />
          <div className="flex gap-3">
            <FloraButton variant="secondary" onClick={() => setStep(1)}>
              Retour
            </FloraButton>
            <FloraButton onClick={() => void runPreview()} disabled={isLoading}>
              {isLoading ? "Analyse IA…" : "Lancer la vérification IA"}
            </FloraButton>
          </div>
        </div>
      ) : null}

      {step === 3 && session && summary ? (
        <div className="space-y-4">
          <FloraCard padding="md" accent="cream">
            <p className="text-sm font-medium">Résumé IA</p>
            <ul className="mt-2 space-y-1 text-sm font-light text-flora-text-muted">
              <li>{summary.sessionCount} séance(s) détectée(s)</li>
              <li>{summary.competences.length} compétence(s) reconnue(s)</li>
              <li>{summary.objectifs.length} objectif(s)</li>
            </ul>
          </FloraCard>
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Session de séquence proposée
            </span>
            <select
              value={selectedSequenceSessionId}
              onChange={(event) => setSelectedSequenceSessionId(event.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            >
              <option value="">Aucune — séance indépendante</option>
              {session.linkSuggestions.sequenceSessions.map((item) => (
                <option key={item.targetId} value={item.targetId}>
                  {item.label} ({Math.round(item.score * 100)} %)
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
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
