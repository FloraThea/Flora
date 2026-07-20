export type PedagogicalModule =
  | "referentiel"
  | "programmation"
  | "progression"
  | "sequence"
  | "emploi_du_temps"
  | "rituels"
  | "cahier_journal"
  | "agenda"
  | "planificateur"
  | "seances"
  | "statistiques";

export type PedagogicalEventType =
  | "programmation.modifiee"
  | "progression.creee"
  | "progression.modifiee"
  | "seance.deplacee"
  | "seance.modifiee"
  | "emploi_du_temps.modifie"
  | "semaine.deplacee"
  | "competence.validee"
  | "rituel.modifie";

export type PedagogicalEvent =
  | { type: "programmation.modifiee"; cellId: string; programmationId: string }
  | { type: "progression.creee"; progressionId: string; programmationId: string }
  | { type: "progression.modifiee"; rowId: string; progressionId?: string }
  | { type: "seance.deplacee"; seanceId: string }
  | { type: "seance.modifiee"; seanceId: string; field?: string }
  | { type: "emploi_du_temps.modifie"; scheduleId?: string; scope?: "slot" | "settings" | "generate" }
  | { type: "semaine.deplacee"; fromWeekNumberInYear: number; toWeekNumberInYear: number; progressionId?: string }
  | { type: "competence.validee"; referentielId: string }
  | { type: "rituel.modifie"; day?: string };

export type SyncScope = {
  journal?: boolean;
  agenda?: boolean;
  progression?: boolean;
  seances?: boolean;
  planner?: boolean;
  stats?: boolean;
  hours?: boolean;
};

export type SyncResult = {
  event: PedagogicalEventType;
  modulesUpdated: PedagogicalModule[];
  journalDaysRegenerated?: number;
  conflicts: PedagogicalConflict[];
  durationMs: number;
};

export type PedagogicalConflict = {
  id: string;
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion?: string;
  module: PedagogicalModule;
  entityId?: string;
  weekNumbers?: number[];
};

export type HoursBalance = {
  subject: string;
  plannedHours: number;
  targetHours: number;
  remainingHours: number;
  delta: number;
  alert?: string;
};

export type CompetenceCoverage = {
  referentielId: string;
  label: string;
  status: "covered" | "partial" | "missing";
  modules: PedagogicalModule[];
};

export type PedagogicalStats = {
  annualProgressPercent: number;
  competencesCovered: number;
  competencesTotal: number;
  hoursBalance: HoursBalance[];
  conflictCount: number;
};

export type ChangeLogEntry = {
  id: string;
  module: PedagogicalModule;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue: unknown;
  newValue: unknown;
  eventType: PedagogicalEventType;
  createdAt: string;
  revertedAt?: string;
};

export type RevertResult = {
  ok: boolean;
  logId: string;
  message: string;
};
