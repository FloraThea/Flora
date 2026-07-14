import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { TimetableSlot } from "@/lib/programming/types";
import type { RitualDefinition } from "./types";

const DEFAULT_RITUALS: RitualDefinition[] = [
  {
    id: "rituel-accueil",
    label: "Accueil et appel",
    frequency: "daily",
    priority: 100,
    startTime: "08:30",
    endTime: "08:45",
    objectif: "Accueillir les élèves, ritualiser le début de journée et vérifier les présences.",
    organisation: "Rituel collectif au sol ou aux tables.",
    dureeMinutes: 15,
  },
  {
    id: "rituel-lecture",
    label: "Lecture du jour",
    matiere: "Français",
    frequency: "daily",
    priority: 80,
    objectif: "Lire et commenter un extrait pour entrer dans la langue.",
    organisation: "Collectif, 10 minutes avant la séance de français si prévue.",
    dureeMinutes: 10,
  },
  {
    id: "rituel-calcul",
    label: "Calcul mental",
    matiere: "Mathématiques",
    frequency: "daily",
    priority: 70,
    objectif: "Automatiser les procédures de calcul.",
    organisation: "Affichage au tableau ou rituel oral rapide.",
    dureeMinutes: 10,
  },
];

function parseProfileRituals(profile: TeacherProfileBundle): RitualDefinition[] {
  const raw = profile.profile.metadata?.rituals;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item, index) => ({
      id: String(item.id ?? `rituel-profile-${index}`),
      label: String(item.label ?? item.name ?? "Rituel"),
      matiere: item.matiere ? String(item.matiere) : undefined,
      startTime: item.startTime ? String(item.startTime) : undefined,
      endTime: item.endTime ? String(item.endTime) : undefined,
      frequency: item.frequency === "weekly" ? "weekly" : "daily",
      priority: Number(item.priority ?? 50),
      objectif: String(item.objectif ?? ""),
      organisation: String(item.organisation ?? ""),
      dureeMinutes: Number(item.dureeMinutes ?? 10),
    }));
}

export class RitualAssembler {
  buildRituals(input: {
    profile: TeacherProfileBundle;
    slots: TimetableSlot[];
    dayName: string;
  }): RitualDefinition[] {
    const profileRituals = parseProfileRituals(input.profile);
    return profileRituals
      .filter((ritual) => {
        if (ritual.frequency === "weekly" && input.dayName === "lundi") return true;
        if (ritual.frequency === "weekly" && input.dayName !== "lundi") return false;
        if (!ritual.matiere) return true;
        const subjects = new Set(input.slots.map((slot) => slot.subject.toLowerCase()));
        return subjects.has(ritual.matiere.toLowerCase());
      })
      .sort((a, b) => b.priority - a.priority);
  }

  attachRitualToSlot(
    rituals: RitualDefinition[],
    slot: TimetableSlot,
  ): RitualDefinition | null {
    const match = rituals.find(
      (ritual) =>
        ritual.matiere &&
        ritual.matiere.toLowerCase() === slot.subject.toLowerCase() &&
        !ritual.startTime,
    );
    return match ?? null;
  }
}

export const ritualAssembler = new RitualAssembler();
