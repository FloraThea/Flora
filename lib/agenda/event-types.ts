import type { FloraAccent } from "@/lib/theme";
import type { AgendaEventCategory, AgendaEventType } from "./types";

export type EventTypeDefinition = {
  type: AgendaEventType;
  label: string;
  category: AgendaEventCategory;
  color: FloraAccent;
  icon: string;
  auto108hCategory?: string;
  defaultDurationMinutes: number;
};

export const AGENDA_EVENT_TYPES: EventTypeDefinition[] = [
  { type: "cours", label: "Cours", category: "pedagogique", color: "sage", icon: "book", defaultDurationMinutes: 60 },
  { type: "seance", label: "Séance", category: "pedagogique", color: "lavender", icon: "sparkles", defaultDurationMinutes: 60 },
  { type: "rituel", label: "Rituel", category: "pedagogique", color: "cream", icon: "sun", defaultDurationMinutes: 15 },
  { type: "reunion", label: "Réunion", category: "administratif", color: "peach", icon: "users", auto108hCategory: "108_equipe_familles", defaultDurationMinutes: 90 },
  { type: "conseil_ecole", label: "Conseil d'école", category: "108h", color: "rose", icon: "school", auto108hCategory: "108_conseils", defaultDurationMinutes: 120 },
  { type: "animation_pedagogique", label: "Animation pédagogique", category: "108h", color: "sage", icon: "palette", auto108hCategory: "108_animations", defaultDurationMinutes: 180 },
  { type: "apc", label: "APC", category: "108h", color: "lavender", icon: "puzzle", auto108hCategory: "108_apc", defaultDurationMinutes: 180 },
  { type: "rdv_parents", label: "Rendez-vous parents", category: "pedagogique", color: "rose", icon: "heart", auto108hCategory: "108_equipe_familles", defaultDurationMinutes: 30 },
  { type: "ess", label: "ESS", category: "108h", color: "peach", icon: "leaf", auto108hCategory: "108_animations", defaultDurationMinutes: 120 },
  { type: "equipe_educative", label: "Équipe éducative", category: "108h", color: "lavender", icon: "team", auto108hCategory: "108_equipe_familles", defaultDurationMinutes: 90 },
  { type: "sortie", label: "Sortie", category: "pedagogique", color: "sage", icon: "map", defaultDurationMinutes: 240 },
  { type: "intervenant", label: "Intervenant", category: "pedagogique", color: "cream", icon: "mic", defaultDurationMinutes: 60 },
  { type: "piscine", label: "Piscine", category: "pedagogique", color: "lavender", icon: "waves", defaultDurationMinutes: 90 },
  { type: "spectacle", label: "Spectacle", category: "pedagogique", color: "rose", icon: "star", defaultDurationMinutes: 120 },
  { type: "evaluation", label: "Évaluation", category: "pedagogique", color: "peach", icon: "clipboard", defaultDurationMinutes: 60 },
  { type: "administratif", label: "Date administrative", category: "administratif", color: "cream", icon: "file", defaultDurationMinutes: 60 },
  { type: "vacances", label: "Vacances", category: "administratif", color: "cream", icon: "palm", defaultDurationMinutes: 0 },
  { type: "personnel", label: "Événement personnel", category: "personnel", color: "rose", icon: "user", defaultDurationMinutes: 60 },
];

export function getEventTypeDefinition(type: AgendaEventType): EventTypeDefinition {
  return AGENDA_EVENT_TYPES.find((item) => item.type === type) ?? AGENDA_EVENT_TYPES.at(-1)!;
}

export const REMINDER_OFFSETS: Array<{ value: "1w" | "1d" | "1h" | "15m"; label: string; minutes: number }> = [
  { value: "1w", label: "1 semaine avant", minutes: 7 * 24 * 60 },
  { value: "1d", label: "1 jour avant", minutes: 24 * 60 },
  { value: "1h", label: "1 heure avant", minutes: 60 },
  { value: "15m", label: "15 minutes avant", minutes: 15 },
];

export const TASK_STATUS_LABELS = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminée",
} as const;

export const TASK_PRIORITY_LABELS = {
  low: "Basse",
  medium: "Normale",
  high: "Haute",
} as const;
