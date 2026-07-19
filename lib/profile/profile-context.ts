import type { ProgrammingGenerationInput } from "@/lib/programming/types";
import {
  getDefaultTimetableFromProfile,
  loadTeacherProfileBundle,
} from "./profile-service";
import type { ProfilCompletionStatus, TeacherProfileBundle } from "./types";
import { filterTimetableByWorkingDays } from "./work-schedule";

export const PROFILE_REQUIRED_MESSAGE =
  "Configurez votre profil pédagogique sur /profil avant de générer.";

export async function getProfileCompletionStatus(
  bundle: TeacherProfileBundle,
): Promise<ProfilCompletionStatus> {
  const { hasActiveTimetableWithSlots } = await import("@/lib/timetable/active-timetable");
  const hasActiveTimetable = await hasActiveTimetableWithSlots(bundle.profile.id);
  const missing = listProfileMissingFields(bundle, hasActiveTimetable);
  return { complete: missing.length === 0, missing };
}

export function listProfileMissingFields(
  bundle: TeacherProfileBundle,
  hasActiveTimetable: boolean,
): string[] {
  const missing: string[] = [];

  if (!bundle.profile.nom.trim()) missing.push("Nom");
  if (!bundle.profile.prenom.trim()) missing.push("Prénom");
  if (!bundle.profile.schoolYear.trim()) missing.push("Année scolaire");
  if (bundle.profile.levels.length === 0) missing.push("Niveau(x)");
  if (bundle.methods.length === 0) missing.push("Méthode pédagogique");
  if (!hasActiveTimetable) {
    missing.push("Emploi du temps actif (module Emploi du temps)");
  }
  if (bundle.profile.workingDays.length === 0) missing.push("Jours travaillés");

  return missing;
}

export async function loadTeacherProfileForGeneration(): Promise<TeacherProfileBundle> {
  const bundle = await loadTeacherProfileBundle();

  if (!bundle) {
    throw new Error(PROFILE_REQUIRED_MESSAGE);
  }

  const status = await getProfileCompletionStatus(bundle);
  if (!status.complete) {
    throw new Error(
      `${PROFILE_REQUIRED_MESSAGE} Champs manquants : ${status.missing.join(", ")}.`,
    );
  }

  return bundle;
}

export function getPrimaryMethod(bundle: TeacherProfileBundle): string {
  return (
    bundle.methods.find((method) => method.isPrimary)?.methodName ??
    bundle.methods[0]?.methodName ??
    ""
  );
}

export function getAnnualProject(bundle: TeacherProfileBundle): string {
  return (
    bundle.projects.find((project) => project.projectType === "annuel")?.title ??
    bundle.projects.find((project) => project.projectType === "theme")?.title ??
    ""
  );
}

export async function applyProfileToProgrammingInput(
  input: ProgrammingGenerationInput,
  bundle: TeacherProfileBundle,
): Promise<ProgrammingGenerationInput> {
  const defaultTimetable = filterTimetableByWorkingDays(
    await getDefaultTimetableFromProfile(bundle),
    bundle.profile.workingDays,
  );
  const primaryMethod = getPrimaryMethod(bundle);
  const timetableSource =
    input.timetable.slots.length > 0 ? input.timetable : defaultTimetable;

  return {
    ...input,
    schoolYear: input.schoolYear || bundle.profile.schoolYear,
    academicZone: input.academicZone || bundle.profile.zoneScolaire,
    levels: input.levels.length > 0 ? input.levels : bundle.profile.levels,
    methode: input.methode || primaryMethod,
    projetAnnuel: input.projetAnnuel || getAnnualProject(bundle),
    timetable: filterTimetableByWorkingDays(timetableSource, bundle.profile.workingDays),
    teacherWorkingDays: bundle.profile.workingDays,
  };
}

export function buildTheaProfileContext(bundle: TeacherProfileBundle): string {
  return JSON.stringify(
    {
      identite: {
        nom: bundle.profile.nom,
        prenom: bundle.profile.prenom,
        ecole: bundle.profile.ecoleNom,
        commune: bundle.profile.commune,
        academie: bundle.profile.academie,
        zoneScolaire: bundle.profile.zoneScolaire,
        pays: bundle.profile.pays,
      },
      classe: {
        anneeScolaire: bundle.profile.schoolYear,
        niveaux: bundle.profile.levels,
        effectif: bundle.profile.studentCount,
        type: bundle.profile.classType,
        ulis: bundle.profile.ulis,
        segpa: bundle.profile.segpa,
        rep: bundle.profile.rep,
        repPlus: bundle.profile.repPlus,
      },
      tempsTravail: {
        quotitePourcentage: bundle.profile.workQuotaPercentage,
        quotiteLabel: bundle.profile.workQuotaLabel,
        joursTravailles: bundle.profile.workingDays,
      },
      methodes: bundle.methods.map((method) => ({
        nom: method.methodName,
        principale: method.isPrimary,
      })),
      pedagogie: bundle.preferences.pedagogyStyles,
      projets: bundle.projects.map((project) => ({
        type: project.projectType,
        titre: project.title,
        description: project.description,
      })),
      ressourcesPrioritaires: bundle.preferences.resourcePriorities,
      preferencesIa: {
        niveauDetail: bundle.preferences.aiDetailLevel,
        tonalite: bundle.preferences.aiTone,
        typeGeneration: bundle.preferences.aiGenerationType,
      },
      personnalisation: bundle.profile.personalization,
      exports: {
        formats: bundle.preferences.exportFormats,
        ordre: bundle.preferences.exportOrder,
      },
    },
    null,
    2,
  );
}

export function buildTheaInstructionBlock(bundle: TeacherProfileBundle): string {
  const { aiDetailLevel, aiTone, aiGenerationType } = bundle.preferences;

  const detailMap = {
    court: "Réponses concises, synthétiques.",
    moyen: "Réponses équilibrées, structurées.",
    tres_detaille: "Réponses très détaillées, exhaustives.",
  } as const;

  const toneMap = {
    institutionnelle: "Ton institutionnel, conforme aux attentes de l'administration.",
    simple: "Ton simple, accessible et direct.",
    tres_pedagogique: "Ton très pédagogique, bienveillant et explicatif.",
  } as const;

  const generationMap = {
    rapide: "Privilégier une génération rapide et efficace.",
    equilibree: "Privilégier un équilibre entre rapidité et profondeur.",
    tres_approfondie: "Privilégier une analyse très approfondie.",
  } as const;

  return `
Profil pédagogique enseignant (mémoire Flora — à respecter impérativement) :
${buildTheaProfileContext(bundle)}

Consignes Théa liées au profil :
- ${detailMap[aiDetailLevel]}
- ${toneMap[aiTone]}
- ${generationMap[aiGenerationType]}
- Adapter les propositions aux méthodes : ${bundle.methods.map((method) => method.methodName).join(", ")}.
- Intégrer les projets de classe quand pertinent.
- Prioriser les ressources : ${bundle.preferences.resourcePriorities.join(", ") || "selon le référentiel BO"}.
- Quotité de travail : ${bundle.profile.workQuotaLabel} (${bundle.profile.workQuotaPercentage} %).
- Jours travaillés : ${bundle.profile.workingDays.join(", ")}. Ne pas planifier de séances les autres jours.
- Adapter la charge annuelle à la quotité réelle de l'enseignant.
`.trim();
}
