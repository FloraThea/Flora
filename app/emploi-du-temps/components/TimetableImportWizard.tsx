"use client";

import { useCallback, useMemo, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { TheaGlow } from "@/components/ui/TheaGlow";
import { SCHOOL_DAYS } from "@/lib/timetable/types";
import type {
  ParsedTimetableImport,
  StructureOverrides,
  SubjectMappingSuggestion,
  TimetableImportSession,
} from "@/lib/timetable/import/types";
import {
  TIMETABLE_SUBJECTS,
  buildSubjectGradient,
  getSubSubjectsForSubject,
  getSubjectBaseColor,
} from "@/lib/timetable/subject-palette";
import type { TimetablePayload } from "@/lib/timetable/types";
import { getFormatsAcceptesLabel, getModuleAcceptAttribute, isAcceptedForModule } from "@/lib/import/accepted-formats";
import { colors } from "@/lib/theme";

function applySessionAppearance(
  session: TimetableImportSession,
  patch: Partial<TimetableImportSession>,
): TimetableImportSession {
  const next = { ...session, ...patch };
  const subSubject = next.subSubject || next.title || "";
  return {
    ...next,
    subSubject,
    color: getSubjectBaseColor(next.subject, next.slotType),
    title: subSubject || next.title,
  };
}

const STEPS = ["Importer", "Correspondances", "Prévisualisation", "Valider"] as const;

const SCHEDULE_PRESETS = [
  "Emploi du temps principal",
  "Période 1",
  "Période 2",
  "Semaine A",
  "Semaine B",
  "Version temporaire",
] as const;

const ALL_DAYS = [...SCHOOL_DAYS, "Samedi"] as const;

type TimetableImportWizardProps = {
  onComplete: (payload: TimetablePayload) => void;
  onClose: () => void;
};

type AnalyzeResponse = {
  parsed?: ParsedTimetableImport;
  error?: string;
  details?: string;
};

function slotBg(_session: TimetableImportSession | undefined): string {
  return "border-white/60";
}

export function TimetableImportWizard({ onComplete, onClose }: TimetableImportWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedTimetableImport | null>(null);
  const [sessions, setSessions] = useState<TimetableImportSession[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [scheduleName, setScheduleName] = useState("Emploi du temps principal");
  const [isPrimary, setIsPrimary] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [manualHeaderRow, setManualHeaderRow] = useState<number>(0);
  const [manualTimeColumn, setManualTimeColumn] = useState<number>(0);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const uncertain = parsed?.uncertainMappings ?? [];
  const needsManual = parsed?.needsManualStructure ?? false;

  const times = useMemo(
    () => [...new Set(sessions.map((s) => s.startTime))].sort(),
    [sessions],
  );
  const days = parsed?.days.length ? parsed.days : [...ALL_DAYS];

  const runAnalyze = useCallback(
    async (structureOverrides?: StructureOverrides) => {
      if (!file) {
        setError("Choisissez un fichier à importer.");
        return;
      }
      if (!isAcceptedForModule("emploi_du_temps", file.name, file.type)) {
        setError(getFormatsAcceptesLabel("emploi_du_temps"));
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const form = new FormData();
        form.append("action", "analyze");
        form.append("file", file);
        if (structureOverrides) {
          form.append("structureOverrides", JSON.stringify(structureOverrides));
        }

        const response = await fetch("/api/emploi-du-temps/import", { method: "POST", body: form });
        const data = (await response.json()) as AnalyzeResponse;

        if (!response.ok) {
          throw new Error(data.details || data.error || "Analyse impossible.");
        }

        const result = data.parsed ?? null;
        setParsed(result);
        setSessions(result?.sessions ?? []);

        if (result?.structure && result.structure.headerRow >= 0) {
          setManualHeaderRow(result.structure.headerRow);
        }
        if (result?.structure && result.structure.timeColumn >= 0) {
          setManualTimeColumn(result.structure.timeColumn);
        }

        const initialMappings: Record<string, string> = {};
        for (const item of result?.uncertainMappings ?? []) {
          initialMappings[item.sourceLabel] = item.suggestedSubject;
        }
        setMappings(initialMappings);

        if (result?.needsManualStructure) return;

        setStep(result?.uncertainMappings.length ? 1 : 2);
      } catch (analyzeError) {
        setError(analyzeError instanceof Error ? analyzeError.message : "Analyse impossible.");
      } finally {
        setIsLoading(false);
      }
    },
    [file],
  );

  async function handleSave() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/emploi-du-temps/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          sessions,
          confirmedMappings: mappings,
          scheduleName,
          isPrimary,
          className: parsed?.className,
          teacherName: parsed?.teacherName,
          schoolYear: parsed?.schoolYear,
          sourceFileName: parsed?.fileName,
        }),
      });

      const data = (await response.json()) as TimetablePayload & { error?: string; details?: string };
      if (!response.ok) throw new Error(data.details || data.error || "Enregistrement impossible.");

      onComplete(data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleValidate() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/emploi-du-temps/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", sessions }),
      });
      const data = (await response.json()) as {
        validation?: { valid: boolean; conflicts: Array<{ message: string }> };
        error?: string;
        details?: string;
      };
      if (!response.ok) throw new Error(data.details || data.error || "Validation impossible.");
      const valid = data.validation?.valid;
      setValidationMessage(
        valid
          ? "Emploi du temps cohérent — prêt à valider."
          : `${data.validation?.conflicts.length ?? 0} alerte(s) détectée(s). Vous pouvez corriger ou valider quand même.`,
      );
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : "Validation impossible.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateSession(index: number, patch: Partial<TimetableImportSession>) {
    setSessions((current) =>
      current.map((s, i) => (i === index ? applySessionAppearance(s, patch) : s)),
    );
  }

  function addSession(day: string, startTime: string) {
    setSessions((current) => [
      ...current,
      applySessionAppearance(
        {
          day,
          startTime,
          endTime: addHalfHour(startTime),
          subject: "Français",
          title: "",
          subSubject: "",
          customText: "",
          level: "",
          group: "",
          location: "",
          notes: "",
          color: getSubjectBaseColor("Français"),
          slotType: "seance",
          rawLabel: "",
          isEmpty: false,
          rowIndex: 0,
          colIndex: 0,
        },
        {},
      ),
    ]);
  }

  function removeSession(index: number) {
    setSessions((current) => current.filter((_, i) => i !== index));
  }

  function mergeWithNext(index: number) {
    setSessions((current) => {
      const session = current[index];
      const nextIndex = current.findIndex(
        (s, i) => i !== index && s.day === session.day && s.startTime > session.startTime,
      );
      if (nextIndex < 0) return current;
      const next = current[nextIndex];
      return current
        .map((s, i) => (i === index ? { ...s, endTime: next.endTime } : s))
        .filter((_, i) => i !== nextIndex);
    });
  }

  async function exportFormat(format: "xlsx" | "csv" | "html") {
    const response = await fetch("/api/emploi-du-temps/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, sessions, scheduleName, className: parsed?.className }),
    });

    if (format === "html") {
      const html = await response.text();
      const win = window.open("", "_blank");
      win?.document.write(html);
      win?.document.close();
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `emploi-du-temps.${format === "csv" ? "csv" : "xlsx"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const gridPreview = parsed?.gridPreview ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/20 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" accent="sage" className="relative w-full max-w-5xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-flora-text-subtle hover:text-flora-text"
          aria-label="Fermer"
        >
          ✕
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-medium" style={{ color: colors.charcoal.DEFAULT }}>
              Importer mon emploi du temps
            </h2>
            <p className="mt-1 text-sm font-light text-flora-text-muted">
              Excel, CSV — Flora analyse intelligemment votre tableau, même si les jours ne sont pas en première ligne.
            </p>
          </div>
          {process.env.NODE_ENV === "development" ? (
            <label className="flex items-center gap-2 text-xs font-light text-flora-text-muted">
              <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} />
              Mode diagnostic
            </label>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {STEPS.map((label, index) => (
            <FloraBadge key={label} accent={step === index ? "sage" : "cream"}>
              {index + 1}. {label}
            </FloraBadge>
          ))}
        </div>

        {step === 0 ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
            <FloraCard padding="md" accent="cream">
              <label className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-sauge-light/60 bg-white/40 px-6 py-10 text-center transition hover:bg-white/60">
                <span className="text-3xl">📅</span>
                <span className="font-serif text-lg">Glissez votre fichier ici</span>
                <span className="text-xs font-light text-flora-text-muted">
                  {getFormatsAcceptesLabel("emploi_du_temps")}
                </span>
                <input
                  type="file"
                  accept={getModuleAcceptAttribute("emploi_du_temps")}
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    setParsed(null);
                    setError(null);
                    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
                    if (nextFile && nextFile.type.startsWith("image/")) {
                      setImagePreviewUrl(URL.createObjectURL(nextFile));
                    } else {
                      setImagePreviewUrl(null);
                    }
                  }}
                />
              </label>
              {file ? (
                <p className="mt-3 text-sm font-light text-flora-text-muted">
                  Fichier sélectionné : {file.name}
                </p>
              ) : null}
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Prévisualisation de l'emploi du temps importé"
                  className="mt-4 max-h-64 w-full rounded-2xl border border-white/70 object-contain bg-white/50"
                />
              ) : null}
              <FloraButton accent="sage" className="mt-4" onClick={() => void runAnalyze()} disabled={isLoading}>
                {isLoading ? "Analyse en cours…" : "Analyser le fichier"}
              </FloraButton>
            </FloraCard>

            <TheaGlow
              size="sm"
              title="Théa vous guide"
              message="Je repère les jours, horaires, matières et cellules fusionnées où qu'ils se trouvent dans le fichier."
            />
          </div>
        ) : null}

        {needsManual && step === 0 ? (
          <FloraCard padding="md" accent="lavender" className="mt-6 space-y-4">
            <TheaGlow
              size="sm"
              pulse={false}
              title="Aide à la structuration"
              message="Je n'ai pas réussi à identifier automatiquement les jours. Indiquez la ligne des jours et la colonne des horaires."
            />

            {gridPreview.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/40 p-2">
                <table className="min-w-full border-collapse text-[10px]">
                  <tbody>
                    {gridPreview.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={
                          rowIndex === manualHeaderRow
                            ? "bg-rose-poudre/30"
                            : rowIndex < (parsed?.diagnostics.decorativeRows.length ?? 0)
                              ? "opacity-50"
                              : ""
                        }
                      >
                        <td className="px-1 font-mono text-flora-text-subtle">{rowIndex}</td>
                        {row.map((cell, colIndex) => (
                          <td
                            key={colIndex}
                            className={`border border-white/40 px-1 py-0.5 ${
                              colIndex === manualTimeColumn ? "bg-sauge-light/40" : ""
                            }`}
                          >
                            {cell || "·"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-light">
                Ligne contenant les jours
                <select
                  className="mt-1 w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
                  value={manualHeaderRow}
                  onChange={(e) => setManualHeaderRow(Number(e.target.value))}
                >
                  {gridPreview.map((_, index) => (
                    <option key={index} value={index}>
                      Ligne {index}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-light">
                Colonne contenant les horaires
                <select
                  className="mt-1 w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
                  value={manualTimeColumn}
                  onChange={(e) => setManualTimeColumn(Number(e.target.value))}
                >
                  {Array.from({ length: gridPreview[0]?.length ?? 8 }, (_, index) => (
                    <option key={index} value={index}>
                      Colonne {index}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <FloraButton
              accent="sage"
              onClick={() =>
                void runAnalyze({
                  layout: "days_in_row",
                  headerRow: manualHeaderRow,
                  timeColumn: manualTimeColumn,
                })
              }
              disabled={isLoading}
            >
              {isLoading ? "Nouvelle analyse…" : "Relancer l'analyse avec ces repères"}
            </FloraButton>
          </FloraCard>
        ) : null}

        {step === 1 ? (
          <div className="mt-8 space-y-4">
            <TheaGlow
              size="sm"
              pulse={false}
              title="Correspondances matières"
              message="Je ne suis pas certaine de certaines correspondances. Voulez-vous les associer ?"
            />

            {uncertain.map((item: SubjectMappingSuggestion) => (
              <FloraCard key={item.sourceLabel} padding="md" accent="lavender">
                <p className="text-sm font-light">
                  « <strong>{item.sourceLabel}</strong> » → suggéré :{" "}
                  <strong>{item.suggestedSubject}</strong>
                </p>
                <select
                  className="mt-3 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2 text-sm"
                  value={mappings[item.sourceLabel] ?? item.suggestedSubject}
                  onChange={(event) =>
                    setMappings((current) => ({
                      ...current,
                      [item.sourceLabel]: event.target.value,
                    }))
                  }
                >
                  {[item.suggestedSubject, ...item.alternatives].filter(Boolean).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FloraCard>
            ))}

            <div className="flex gap-2">
              <FloraButton accent="cream" variant="secondary" onClick={() => setStep(0)}>
                Retour
              </FloraButton>
              <FloraButton
                accent="sage"
                onClick={() => {
                  const remapped = sessions.map((session) => {
                    const mapped = mappings[session.rawLabel];
                    if (!mapped) return session;
                    return { ...session, subject: mapped };
                  });
                  setSessions(remapped);
                  setStep(2);
                }}
              >
                Continuer
              </FloraButton>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <FloraButton accent="cream" size="sm" variant="secondary" onClick={() => void exportFormat("xlsx")}>
                Export Excel
              </FloraButton>
              <FloraButton accent="cream" size="sm" variant="secondary" onClick={() => void exportFormat("csv")}>
                Export CSV
              </FloraButton>
              <FloraButton accent="cream" size="sm" variant="secondary" onClick={() => void exportFormat("html")}>
                Aperçu imprimable
              </FloraButton>
              {parsed?.structure ? (
                <FloraBadge accent="cream">
                  Confiance structure : {Math.round((parsed.structure.confidence || 0) * 100)}%
                </FloraBadge>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-3xl border border-white/60 bg-white/35 p-4">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-serif">Horaire</th>
                    {days.map((day) => (
                      <th key={day} className="p-2 text-left font-serif">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {times.map((time) => (
                    <tr key={time}>
                      <td className="p-2 font-light text-flora-text-muted">{time}</td>
                      {days.map((day) => {
                        const index = sessions.findIndex(
                          (s) => s.day === day && s.startTime === time,
                        );
                        const session = index >= 0 ? sessions[index] : undefined;
                        return (
                          <td
                            key={`${day}-${time}`}
                            className={`p-1 align-top ${slotBg(session)} rounded-2xl border`}
                            style={
                              session
                                ? {
                                    background: buildSubjectGradient(
                                      session.subject,
                                      session.subSubject || session.title,
                                      session.slotType,
                                    ),
                                  }
                                : undefined
                            }
                          >
                            {session ? (
                              <div className="space-y-1.5 p-2">
                                <p className="text-[10px] font-medium opacity-80">
                                  {session.startTime} – {session.endTime}
                                </p>
                                <select
                                  className="w-full rounded-lg border border-white/50 bg-white/55 px-1 py-1 text-xs font-medium"
                                  value={session.subject}
                                  onChange={(e) =>
                                    updateSession(index, {
                                      subject: e.target.value,
                                      subSubject: "",
                                      title: "",
                                    })
                                  }
                                >
                                  {TIMETABLE_SUBJECTS.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="w-full rounded-lg border border-white/50 bg-white/55 px-1 py-1 text-xs"
                                  value={session.subSubject || session.title || ""}
                                  onChange={(e) =>
                                    updateSession(index, {
                                      subSubject: e.target.value,
                                      title: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Sous-matière</option>
                                  {getSubSubjectsForSubject(session.subject).map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="w-full rounded-lg border border-white/50 bg-white/55 px-2 py-1 text-[10px] italic"
                                  placeholder="Texte libre"
                                  value={session.customText ?? ""}
                                  onChange={(e) =>
                                    updateSession(index, { customText: e.target.value })
                                  }
                                />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="text-[10px] text-[#b88989]"
                                    onClick={() => removeSession(index)}
                                  >
                                    Supprimer
                                  </button>
                                  <button
                                    type="button"
                                    className="text-[10px] text-flora-text-subtle"
                                    onClick={() => mergeWithNext(index)}
                                  >
                                    Fusionner ↓
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="w-full p-2 text-xs text-flora-text-subtle hover:bg-white/40"
                                onClick={() => addSession(day, time)}
                              >
                                + Ajouter
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(parsed?.emptySlots.length ?? 0) > 0 ? (
              <FloraCard padding="md" accent="rose" className="mt-4">
                <p className="text-sm font-light">
                  {parsed?.emptySlots.length} créneau(x) vide(s) détecté(s). Ajoutez une séance manuellement dans la
                  grille si besoin.
                </p>
              </FloraCard>
            ) : null}

            <div className="mt-4 flex gap-2">
              <FloraButton accent="cream" variant="secondary" onClick={() => setStep(uncertain.length ? 1 : 0)}>
                Retour
              </FloraButton>
              <FloraButton accent="sage" onClick={() => setStep(3)}>
                Continuer vers validation
              </FloraButton>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-8 space-y-4">
            <FloraCard padding="md" accent="sage">
              <label className="block text-sm font-light text-flora-text-muted">Nom de l&apos;emploi du temps</label>
              <select
                className="mt-2 w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-2 text-sm"
                value={scheduleName}
                onChange={(event) => setScheduleName(event.target.value)}
              >
                {SCHEDULE_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
              <label className="mt-4 flex items-center gap-2 text-sm font-light">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(event) => setIsPrimary(event.target.checked)}
                />
                Définir comme emploi du temps principal (alimente le cahier journal)
              </label>
            </FloraCard>

            {validationMessage ? (
              <p className="text-sm font-light text-sauge">{validationMessage}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <FloraButton accent="cream" variant="secondary" onClick={() => setStep(2)}>
                Retour
              </FloraButton>
              <FloraButton accent="lavender" variant="secondary" onClick={() => void handleValidate()} disabled={isLoading}>
                Vérifier la cohérence
              </FloraButton>
              <FloraButton accent="rose" onClick={() => void handleSave()} disabled={isLoading}>
                {isLoading ? "Enregistrement…" : "Valider cet emploi du temps"}
              </FloraButton>
            </div>

            <p className="text-xs font-light text-flora-text-muted">
              Une fois validé, l&apos;emploi du temps alimente le cahier journal, les programmations et les
              créneaux récurrents.
            </p>
          </div>
        ) : null}

        {showDebug && parsed?.diagnostics ? (
          <FloraCard padding="md" accent="cream" className="mt-4">
            <h3 className="font-serif text-lg text-flora-text">Journal de diagnostic</h3>
            <ul className="mt-3 space-y-1 text-xs font-light text-flora-text-muted">
              <li>Disposition : {parsed.diagnostics.layout}</li>
              <li>Ligne jours détectée : {parsed.diagnostics.detectedDayRow ?? "—"}</li>
              <li>Colonne horaires détectée : {parsed.diagnostics.detectedTimeColumn ?? "—"}</li>
              <li>Cellules fusionnées : {parsed.diagnostics.mergedCellCount}</li>
              <li>
                Matières détectées :{" "}
                {parsed.diagnostics.detectedSubjects.length
                  ? parsed.diagnostics.detectedSubjects.join(", ")
                  : "—"}
              </li>
              <li>Lignes décoratives ignorées : {parsed.diagnostics.decorativeRows.join(", ") || "—"}</li>
              {parsed.diagnostics.anomalies.map((item) => (
                <li key={item} className="text-[#b88989]">
                  • {item}
                </li>
              ))}
            </ul>
          </FloraCard>
        ) : null}

        {parsed?.warnings.length ? (
          <FloraCard padding="sm" accent="cream" className="mt-4">
            <ul className="space-y-1 text-xs font-light text-flora-text-muted">
              {parsed.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </FloraCard>
        ) : null}

        {error ? (
          <FloraCard padding="sm" accent="rose" className="mt-4">
            <p className="text-sm font-light text-[#b88989]">{error}</p>
          </FloraCard>
        ) : null}
      </FloraCard>
    </div>
  );
}

function addHalfHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + 30;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
