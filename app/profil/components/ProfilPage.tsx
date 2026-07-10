"use client";

import { useEffect, useRef, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { buildSchoolYearOptions } from "@/app/programmation/types";
import {
  AI_DETAIL_LEVELS,
  AI_GENERATION_TYPES,
  AI_TONES,
  EXPORT_FORMAT_OPTIONS,
  PEDAGOGY_STYLE_OPTIONS,
  PROFILE_METHOD_OPTIONS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
  RESOURCE_PRIORITY_OPTIONS,
  type ProfilFormValues,
  type TeacherProject,
  type TeacherProjectType,
} from "@/lib/profile/types";
import {
  clampWorkQuotaPercentage,
  resolveWorkQuotaLabel,
  suggestWorkingDaysForQuota,
  TEACHER_WORKING_DAY_OPTIONS,
  WORK_QUOTA_PRESETS,
  type TeacherWorkingDay,
  type WorkQuotaPreset,
} from "@/lib/profile/work-schedule";
import { accents, colors } from "@/lib/theme";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { useFloraTheme } from "@/components/theme/ThemeProvider";
import type { FloraAppThemeId } from "@/lib/themes/types";
import {
  CLASS_TYPE_OPTIONS,
  createTimetableEntry,
  emptyProject,
  ensureDefaultTimetableId,
  initialProfilValues,
  inputClassName,
  labelClassName,
  SCHOOL_LEVELS,
} from "../types";

type ProfilApiResponse = {
  values: ProfilFormValues;
  status: string;
  completion: { complete: boolean; missing: string[] };
  error?: string;
};

function SectionTitle({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-poudre/30 text-sm font-medium text-[#b88989]">
        {number}
      </span>
      <h2 className="font-serif text-xl font-light text-flora-text">{title}</h2>
    </div>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-light transition ${
        active
          ? "bg-rose-poudre/40 text-flora-text"
          : "bg-white/45 text-flora-text-muted hover:bg-white/70"
      }`}
    >
      {label}
    </button>
  );
}

export function ProfilPage() {
  const { themeId, setThemeId } = useFloraTheme();
  const [values, setValues] = useState<ProfilFormValues>(initialProfilValues);
  const [completion, setCompletion] = useState<{ complete: boolean; missing: string[] }>({
    complete: false,
    missing: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const workingDaysCustomizedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileOnMount() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/profil");
        const data = (await response.json()) as ProfilApiResponse;

        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger le profil.");
        }

        if (!cancelled) {
          const loaded = ensureDefaultTimetableId(data.values);
          setValues(loaded);
          setThemeId(loaded.personalization.appTheme ?? "flora");
          setCompletion(data.completion);
          workingDaysCustomizedRef.current = true;
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Erreur de chargement.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfileOnMount();

    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof ProfilFormValues>(key: K, value: ProfilFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSavedMessage(null);
  };

  const updateWorkQuotaPreset = (preset: WorkQuotaPreset) => {
    const option = WORK_QUOTA_PRESETS.find((item) => item.value === preset);
    const percentage =
      preset === "custom"
        ? values.workQuotaPercentage
        : clampWorkQuotaPercentage(option?.percentage ?? 100);

    setValues((current) => ({
      ...current,
      workQuotaPreset: preset,
      workQuotaPercentage: percentage,
      workQuotaLabel: resolveWorkQuotaLabel(percentage, preset),
      workingDays: workingDaysCustomizedRef.current
        ? current.workingDays
        : suggestWorkingDaysForQuota(percentage),
    }));
    setSavedMessage(null);
  };

  const updateCustomQuotaPercentage = (raw: number) => {
    const percentage = clampWorkQuotaPercentage(raw);
    setValues((current) => ({
      ...current,
      workQuotaPercentage: percentage,
      workQuotaLabel: resolveWorkQuotaLabel(percentage, "custom"),
      workingDays: workingDaysCustomizedRef.current
        ? current.workingDays
        : suggestWorkingDaysForQuota(percentage),
    }));
    setSavedMessage(null);
  };

  const toggleWorkingDay = (day: TeacherWorkingDay) => {
    workingDaysCustomizedRef.current = true;
    setValues((current) => {
      const next = current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day];
      return {
        ...current,
        workingDays: TEACHER_WORKING_DAY_OPTIONS.map((option) => option.value).filter((value) =>
          next.includes(value),
        ),
      };
    });
    setSavedMessage(null);
  };

  const toggleInList = (key: "methods" | "pedagogyStyles" | "resourcePriorities" | "exportFormats", item: string) => {
    setValues((current) => {
      const list = current[key];
      const next = list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
      return { ...current, [key]: next };
    });
    setSavedMessage(null);
  };

  const toggleLevel = (level: (typeof SCHOOL_LEVELS)[number]) => {
    setValues((current) => ({
      ...current,
      levels: current.levels.includes(level)
        ? current.levels.filter((item) => item !== level)
        : [...current.levels, level],
    }));
    setSavedMessage(null);
  };

  const addProject = (projectType: TeacherProjectType) => {
    setValues((current) => ({
      ...current,
      projects: [...current.projects, emptyProject(projectType)],
    }));
    setSavedMessage(null);
  };

  const updateProject = (index: number, patch: Partial<TeacherProject>) => {
    setValues((current) => ({
      ...current,
      projects: current.projects.map((project, projectIndex) =>
        projectIndex === index ? { ...project, ...patch } : project,
      ),
    }));
    setSavedMessage(null);
  };

  const removeProject = (index: number) => {
    setValues((current) => ({
      ...current,
      projects: current.projects.filter((_, projectIndex) => projectIndex !== index),
    }));
    setSavedMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);

    const payload = ensureDefaultTimetableId({
      ...values,
      primaryMethod: values.methods.includes(values.primaryMethod)
        ? values.primaryMethod
        : values.methods[0] ?? "",
    });

    try {
      const response = await fetch("/api/profil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ProfilApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'enregistrer le profil.");
      }

      setValues(ensureDefaultTimetableId(data.values));
      setCompletion(data.completion);
      setSavedMessage("Profil enregistré. Toutes les générations utiliseront ces paramètres.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erreur d'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <FloraCard padding="lg">
        <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
          Chargement de votre profil pédagogique…
        </p>
      </FloraCard>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <FloraPageTitle
            title="Profil pédagogique"
            subtitle="Configurez une seule fois votre manière de travailler. Théa s&apos;appuiera sur cette mémoire pour toutes les générations."
          />
          {completion.complete ? (
            <FloraBadge accent="sage">Profil complet</FloraBadge>
          ) : (
            <FloraBadge accent="peach">Profil incomplet</FloraBadge>
          )}
        </div>

        <FloraButton onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer le profil"}
        </FloraButton>
      </div>

      {!completion.complete && completion.missing.length > 0 && (
        <FloraCard padding="md" accent="peach">
          <p className="text-sm font-light text-flora-text-muted">
            Champs requis pour activer les générations :{" "}
            <span className="text-flora-text">{completion.missing.join(", ")}</span>
          </p>
        </FloraCard>
      )}

      {savedMessage && (
        <FloraCard padding="md" accent="sage">
          <p className="text-sm font-light text-flora-text-muted">{savedMessage}</p>
        </FloraCard>
      )}

      {error && (
        <FloraCard padding="md" accent="peach">
          <p className="text-sm font-light text-flora-text-muted">{error}</p>
        </FloraCard>
      )}

      <FloraCard padding="lg" accent="rose">
        <SectionTitle number={1} title="Identité" />
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block">
            <span className={labelClassName}>Nom</span>
            <input value={values.nom} onChange={(e) => update("nom", e.target.value)} className={inputClassName} />
          </label>
          <label className="block">
            <span className={labelClassName}>Prénom</span>
            <input value={values.prenom} onChange={(e) => update("prenom", e.target.value)} className={inputClassName} />
          </label>
          <label className="block">
            <span className={labelClassName}>Nom de l&apos;école</span>
            <input value={values.ecoleNom} onChange={(e) => update("ecoleNom", e.target.value)} className={inputClassName} />
          </label>
          <label className="block">
            <span className={labelClassName}>Commune</span>
            <input value={values.commune} onChange={(e) => update("commune", e.target.value)} className={inputClassName} />
          </label>
          <label className="block">
            <span className={labelClassName}>Académie</span>
            <input value={values.academie} onChange={(e) => update("academie", e.target.value)} className={inputClassName} />
          </label>
          <label className="block">
            <span className={labelClassName}>Zone scolaire</span>
            <select
              value={values.zoneScolaire}
              onChange={(e) => update("zoneScolaire", e.target.value as ProfilFormValues["zoneScolaire"])}
              className={inputClassName}
            >
              <option value="A">Zone A</option>
              <option value="B">Zone B</option>
              <option value="C">Zone C</option>
            </select>
          </label>
          <label className="block lg:col-span-2">
            <span className={labelClassName}>Pays</span>
            <input value={values.pays} onChange={(e) => update("pays", e.target.value)} className={inputClassName} />
          </label>
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="lavender">
        <SectionTitle number={2} title="Classe" />
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block">
            <span className={labelClassName}>Année scolaire</span>
            <select
              value={values.schoolYear}
              onChange={(e) => update("schoolYear", e.target.value)}
              className={inputClassName}
            >
              {buildSchoolYearOptions().map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClassName}>Nombre d&apos;élèves</span>
            <input
              type="number"
              min={1}
              value={values.studentCount}
              onChange={(e) => update("studentCount", Number(e.target.value) || 0)}
              className={inputClassName}
            />
          </label>
          <div className="lg:col-span-2">
            <span className={labelClassName}>Niveau(x)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SCHOOL_LEVELS.map((level) => (
                <ToggleChip
                  key={level}
                  label={level}
                  active={values.levels.includes(level)}
                  onClick={() => toggleLevel(level)}
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <span className={labelClassName}>Organisation de la classe</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CLASS_TYPE_OPTIONS.map((option) => (
                <ToggleChip
                  key={option.value}
                  label={option.label}
                  active={values.classType === option.value}
                  onClick={() => update("classType", option.value)}
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-wrap gap-2">
            {[
              { key: "ulis" as const, label: "ULIS" },
              { key: "segpa" as const, label: "SEGPA" },
              { key: "rep" as const, label: "REP" },
              { key: "repPlus" as const, label: "REP+" },
            ].map((flag) => (
              <ToggleChip
                key={flag.key}
                label={flag.label}
                active={values[flag.key]}
                onClick={() => update(flag.key, !values[flag.key])}
              />
            ))}
          </div>
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="peach">
        <SectionTitle number={3} title="Temps de travail" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <span className={labelClassName}>Quotité de temps travaillé</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {WORK_QUOTA_PRESETS.map((preset) => (
                <ToggleChip
                  key={preset.value}
                  label={preset.label}
                  active={values.workQuotaPreset === preset.value}
                  onClick={() => updateWorkQuotaPreset(preset.value)}
                />
              ))}
            </div>
            {values.workQuotaPreset === "custom" ? (
              <label className="mt-4 block max-w-xs">
                <span className={labelClassName}>Pourcentage personnalisé</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={values.workQuotaPercentage}
                  onChange={(event) => updateCustomQuotaPercentage(Number(event.target.value) || 1)}
                  className={inputClassName}
                />
              </label>
            ) : (
              <p className="mt-3 text-sm font-light text-flora-text-subtle">
                Quotité sélectionnée : {values.workQuotaLabel}
              </p>
            )}
          </div>

          <div className="lg:col-span-2">
            <span className={labelClassName}>Jours travaillés</span>
            <p className="mt-1 text-sm font-light text-flora-text-subtle">
              Sélectionnez vos jours de présence en classe. Une suggestion est proposée selon la
              quotité, modifiable à tout moment.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEACHER_WORKING_DAY_OPTIONS.map((day) => (
                <ToggleChip
                  key={day.value}
                  label={day.label}
                  active={values.workingDays.includes(day.value)}
                  onClick={() => toggleWorkingDay(day.value)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs font-light text-flora-text-subtle">
              {values.workingDays.length} jour{values.workingDays.length > 1 ? "s" : ""} sélectionné
              {values.workingDays.length > 1 ? "s" : ""} : {values.workingDays.join(", ") || "—"}
            </p>
          </div>
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="sage">
        <SectionTitle number={4} title="Emploi du temps" />
        <div className="mb-4 flex flex-wrap gap-2">
          <FloraButton
            variant="secondary"
            onClick={() => {
              const entry = createTimetableEntry(`Emploi du temps ${values.timetables.length + 1}`);
              setValues((current) => ({
                ...current,
                timetables: [...current.timetables, entry],
                defaultTimetableId: current.defaultTimetableId || entry.id,
              }));
            }}
          >
            Ajouter un emploi du temps
          </FloraButton>
        </div>
        <div className="grid gap-4">
          {values.timetables.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-white/70 bg-white/45 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <input
                  value={entry.name}
                  onChange={(event) => {
                    setValues((current) => ({
                      ...current,
                      timetables: current.timetables.map((item) =>
                        item.id === entry.id ? { ...item, name: event.target.value } : item,
                      ),
                    }));
                  }}
                  className={inputClassName}
                />
                <label className="flex items-center gap-2 text-sm font-light text-flora-text-muted">
                  <input
                    type="radio"
                    name="defaultTimetable"
                    checked={values.defaultTimetableId === entry.id}
                    onChange={() => update("defaultTimetableId", entry.id)}
                  />
                  Par défaut
                </label>
              </div>
              <textarea
                rows={6}
                value={JSON.stringify(entry.timetable.weeklyHoursBySubject, null, 2)}
                onChange={(event) => {
                  try {
                    const weeklyHoursBySubject = JSON.parse(event.target.value) as Record<string, number>;
                    setValues((current) => ({
                      ...current,
                      timetables: current.timetables.map((item) =>
                        item.id === entry.id
                          ? { ...item, timetable: { ...item.timetable, weeklyHoursBySubject } }
                          : item,
                      ),
                    }));
                  } catch {
                    // ignore invalid JSON while typing
                  }
                }}
                className={`${inputClassName} font-mono text-xs`}
              />
            </div>
          ))}
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="peach">
        <SectionTitle number={5} title="Méthodes" />
        <p className="mb-4 text-sm font-light text-flora-text-muted">
          Sélectionnez toutes les méthodes utilisées. Indiquez la méthode principale.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PROFILE_METHOD_OPTIONS.map((method) => (
            <ToggleChip
              key={method}
              label={method}
              active={values.methods.includes(method)}
              onClick={() => toggleInList("methods", method)}
            />
          ))}
        </div>
        {values.methods.length > 0 && (
          <label className="block max-w-sm">
            <span className={labelClassName}>Méthode principale</span>
            <select
              value={values.primaryMethod}
              onChange={(e) => update("primaryMethod", e.target.value)}
              className={inputClassName}
            >
              {values.methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
        )}
      </FloraCard>

      <FloraCard padding="lg" accent="cream">
        <SectionTitle number={6} title="Pédagogie" />
        <div className="flex flex-wrap gap-2">
          {PEDAGOGY_STYLE_OPTIONS.map((option) => (
            <ToggleChip
              key={option.value}
              label={option.label}
              active={values.pedagogyStyles.includes(option.value)}
              onClick={() => toggleInList("pedagogyStyles", option.value)}
            />
          ))}
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="rose">
        <SectionTitle number={7} title="Projets" />
        <div className="mb-4 flex flex-wrap gap-2">
          {PROJECT_TYPES.map((projectType) => (
            <FloraButton key={projectType} variant="secondary" onClick={() => addProject(projectType)}>
              + {PROJECT_TYPE_LABELS[projectType]}
            </FloraButton>
          ))}
        </div>
        <div className="grid gap-4">
          {values.projects.map((project, index) => (
            <div key={`${project.projectType}-${index}`} className="rounded-2xl border border-white/70 bg-white/45 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-flora-text">
                  {PROJECT_TYPE_LABELS[project.projectType]}
                </span>
                <button
                  type="button"
                  onClick={() => removeProject(index)}
                  className="text-xs font-light text-[#b88989] hover:underline"
                >
                  Supprimer
                </button>
              </div>
              <div className="grid gap-3">
                <input
                  placeholder="Titre"
                  value={project.title}
                  onChange={(e) => updateProject(index, { title: e.target.value })}
                  className={inputClassName}
                />
                <textarea
                  placeholder="Description"
                  rows={2}
                  value={project.description}
                  onChange={(e) => updateProject(index, { description: e.target.value })}
                  className={inputClassName}
                />
              </div>
            </div>
          ))}
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="lavender">
        <SectionTitle number={8} title="Ressources prioritaires" />
        <div className="flex flex-wrap gap-2">
          {RESOURCE_PRIORITY_OPTIONS.map((option) => (
            <ToggleChip
              key={option.value}
              label={option.label}
              active={values.resourcePriorities.includes(option.value)}
              onClick={() => toggleInList("resourcePriorities", option.value)}
            />
          ))}
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="sage">
        <SectionTitle number={9} title="Génération IA" />
        <div className="grid gap-6 lg:grid-cols-3">
          <label className="block">
            <span className={labelClassName}>Niveau de détail</span>
            <select
              value={values.aiDetailLevel}
              onChange={(e) => update("aiDetailLevel", e.target.value as ProfilFormValues["aiDetailLevel"])}
              className={inputClassName}
            >
              {AI_DETAIL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level === "court" ? "Court" : level === "moyen" ? "Moyen" : "Très détaillé"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClassName}>Tonalité</span>
            <select
              value={values.aiTone}
              onChange={(e) => update("aiTone", e.target.value as ProfilFormValues["aiTone"])}
              className={inputClassName}
            >
              {AI_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {tone === "institutionnelle"
                    ? "Institutionnelle"
                    : tone === "simple"
                      ? "Simple"
                      : "Très pédagogique"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClassName}>Type de génération</span>
            <select
              value={values.aiGenerationType}
              onChange={(e) =>
                update("aiGenerationType", e.target.value as ProfilFormValues["aiGenerationType"])
              }
              className={inputClassName}
            >
              {AI_GENERATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "rapide" ? "Rapide" : type === "equilibree" ? "Équilibrée" : "Très approfondie"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="lavender">
        <SectionTitle number={10} title="Apparence" />
        <p className="mb-5 text-sm font-light text-flora-text-muted">
          Choisissez l&apos;ambiance graphique de Flora. Le changement est instantané et mémorisé dans votre profil.
        </p>
        <ThemePicker
          value={(values.personalization.appTheme ?? themeId) as FloraAppThemeId}
          onChange={(nextTheme) => {
            setThemeId(nextTheme);
            update("personalization", {
              ...values.personalization,
              appTheme: nextTheme,
            });
          }}
        />
      </FloraCard>

      <FloraCard padding="lg" accent="peach">
        <SectionTitle number={11} title="Personnalisation des exports" />
        <div className="grid gap-6 lg:grid-cols-2">
          <label className="block">
            <span className={labelClassName}>Couleur d&apos;accent</span>
            <select
              value={values.personalization.accentColor}
              onChange={(e) =>
                update("personalization", {
                  ...values.personalization,
                  accentColor: e.target.value as ProfilFormValues["personalization"]["accentColor"],
                })
              }
              className={inputClassName}
            >
              {accents.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClassName}>Polices</span>
            <select
              value={values.personalization.fontStyle}
              onChange={(e) =>
                update("personalization", {
                  ...values.personalization,
                  fontStyle: e.target.value as ProfilFormValues["personalization"]["fontStyle"],
                })
              }
              className={inputClassName}
            >
              <option value="serif">Serif</option>
              <option value="sans">Sans-serif</option>
              <option value="mix">Mixte</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClassName}>Nom de la classe</span>
            <input
              value={values.personalization.className}
              onChange={(e) =>
                update("personalization", { ...values.personalization, className: e.target.value })
              }
              className={inputClassName}
            />
          </label>
          <label className="block">
            <span className={labelClassName}>Nom de l&apos;école (exports)</span>
            <input
              value={values.personalization.schoolName}
              onChange={(e) =>
                update("personalization", { ...values.personalization, schoolName: e.target.value })
              }
              className={inputClassName}
            />
          </label>
          <label className="block lg:col-span-2">
            <span className={labelClassName}>Logo (URL)</span>
            <input
              value={values.personalization.logoUrl}
              onChange={(e) =>
                update("personalization", { ...values.personalization, logoUrl: e.target.value })
              }
              className={inputClassName}
            />
          </label>
          <label className="block lg:col-span-2">
            <span className={labelClassName}>Signature</span>
            <textarea
              rows={2}
              value={values.personalization.signature}
              onChange={(e) =>
                update("personalization", { ...values.personalization, signature: e.target.value })
              }
              className={inputClassName}
            />
          </label>
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="cream">
        <SectionTitle number={11} title="Export" />
        <p className="mb-4 text-sm font-light text-flora-text-muted">Formats préférés et ordre d&apos;affichage.</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {EXPORT_FORMAT_OPTIONS.map((option) => (
            <ToggleChip
              key={option.value}
              label={option.label}
              active={values.exportFormats.includes(option.value)}
              onClick={() => toggleInList("exportFormats", option.value)}
            />
          ))}
        </div>
        <label className="block max-w-md">
          <span className={labelClassName}>Ordre des exports</span>
          <input
            value={values.exportOrder.join(", ")}
            onChange={(e) =>
              update(
                "exportOrder",
                e.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
            className={inputClassName}
            placeholder="word, pdf, excel"
          />
        </label>
      </FloraCard>

      <div className="flex justify-end pb-8">
        <FloraButton onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? "Enregistrement…" : "Enregistrer le profil"}
        </FloraButton>
      </div>
    </div>
  );
}
