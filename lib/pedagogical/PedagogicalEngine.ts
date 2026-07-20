import { detectPedagogicalConflicts } from "./conflict-detector";
import { listPedagogicalChanges, logPedagogicalChange, revertPedagogicalChange } from "./change-history";
import {
  propagateReferentielIdsToJournal,
  resolveReferentielIds,
  syncCellReferentielIds,
} from "./competence-resolver";
import { pedagogicalEventBus } from "./events";
import { recalculateHourVolumes, recalculatePedagogicalStats } from "./hours-calculator";
import {
  handleProgrammationModified,
  handleProgressionCreated,
  handleProgressionModified,
  handleSeanceModified,
  handleTimetableModified,
  handleWeekMoved,
  resolveProgrammationIdFromCell,
} from "./sync-handlers";
import { journalPropagationService } from "@/lib/journal/JournalPropagationService";
import type {
  ChangeLogEntry,
  CompetenceCoverage,
  HoursBalance,
  PedagogicalConflict,
  PedagogicalEvent,
  PedagogicalStats,
  RevertResult,
  SyncResult,
  SyncScope,
} from "./types";

/**
 * Moteur Pédagogique Intelligent — cœur de Flora.
 * Source unique de vérité, synchronisation automatique, détection de conflits.
 * Aucune interface visible : fonctionne en arrière-plan.
 */
export class PedagogicalEngine {
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
  }

  async emit(event: PedagogicalEvent, scope?: SyncScope): Promise<SyncResult> {
    this.initialize();
    const started = Date.now();
    const modulesUpdated: SyncResult["modulesUpdated"] = [];
    let journalDaysRegenerated = 0;

    if (event.type === "programmation.modifiee") {
      const result = await handleProgrammationModified(event, scope);
      if (result.progressionRows > 0) modulesUpdated.push("progression");
      if (result.journalEntries > 0) modulesUpdated.push("cahier_journal");
      modulesUpdated.push("programmation", "statistiques");
    }

    if (event.type === "progression.modifiee") {
      journalDaysRegenerated = await handleProgressionModified(event, scope);
      modulesUpdated.push("progression", "cahier_journal");
    }

    if (event.type === "progression.creee") {
      journalDaysRegenerated = await handleProgressionCreated(event, scope);
      modulesUpdated.push("progression", "cahier_journal");
    }

    if (event.type === "seance.modifiee" || event.type === "seance.deplacee") {
      journalDaysRegenerated = await handleSeanceModified(event, scope);
      modulesUpdated.push("seances", "cahier_journal", "agenda");
    }

    if (event.type === "emploi_du_temps.modifie") {
      journalDaysRegenerated = await handleTimetableModified(scope);
      modulesUpdated.push("emploi_du_temps", "cahier_journal", "agenda");
    }

    if (event.type === "semaine.deplacee") {
      await handleWeekMoved(event, scope);
      modulesUpdated.push("planificateur", "progression", "cahier_journal", "agenda");
    }

    // Permet aux extensions futures de s'abonner sans modifier le moteur
    await pedagogicalEventBus.emit(event);

    const conflicts = await detectPedagogicalConflicts();

    return {
      event: event.type,
      modulesUpdated: [...new Set(modulesUpdated)],
      journalDaysRegenerated,
      conflicts,
      durationMs: Date.now() - started,
    };
  }

  /** Synchronise une programmation modifiée vers progressions, séances et journal. */
  async synchroniserProgrammation(cellId: string, programmationId?: string): Promise<SyncResult> {
    const resolvedId = programmationId ?? (await resolveProgrammationIdFromCell(cellId));
    if (!resolvedId) {
      throw new Error("Programmation introuvable pour cette cellule.");
    }

    return this.emit({ type: "programmation.modifiee", cellId, programmationId: resolvedId });
  }

  /** Synchronise une progression modifiée. */
  async synchroniserProgression(rowId: string, progressionId?: string): Promise<SyncResult> {
    return this.emit({ type: "progression.modifiee", rowId, progressionId });
  }

  /** Génère / régénère le cahier journal pour une programmation. */
  async genererCahierJournal(programmationId: string): Promise<number> {
    return journalPropagationService.syncFromProgrammation(programmationId);
  }

  /** Recalcule les volumes horaires par discipline. */
  async recalculerVolumesHoraires(): Promise<HoursBalance[]> {
    return recalculateHourVolumes();
  }

  /** Vérifie la couverture des compétences BO par identifiant unique. */
  async verifierCompetences(labels: string[]): Promise<CompetenceCoverage[]> {
    const { computeBoCoverageReport } = await import("./intelligence/bo-coverage");
    const report = await computeBoCoverageReport();
    const labelSet = new Set(labels.map((label) => label.trim().toLowerCase()).filter(Boolean));

    const all = [...report.covered, ...report.partial, ...report.missing, ...report.duplicate];
    const filtered = labelSet.size
      ? all.filter((item) => labelSet.has(item.label.toLowerCase()))
      : all;

    return filtered.map((item) => ({
      referentielId: item.referentielId,
      label: item.label,
      status: item.status,
      modules: item.modules,
    }));
  }

  /** Détecte les conflits pédagogiques avec suggestions de correction. */
  async detecterConflits(): Promise<PedagogicalConflict[]> {
    return detectPedagogicalConflicts();
  }

  /** Met à jour le planificateur annuel après un déplacement de semaine. */
  async mettreAJourPlanificateur(input: {
    fromWeekNumberInYear: number;
    toWeekNumberInYear: number;
    progressionId?: string;
  }): Promise<SyncResult> {
    return this.emit({
      type: "semaine.deplacee",
      fromWeekNumberInYear: input.fromWeekNumberInYear,
      toWeekNumberInYear: input.toWeekNumberInYear,
      progressionId: input.progressionId,
    });
  }

  /** Recalcule les statistiques du tableau de bord. */
  async recalculerStatistiques(): Promise<PedagogicalStats> {
    const conflicts = await detectPedagogicalConflicts();
    return recalculatePedagogicalStats(conflicts.length);
  }

  /** Historique des modifications cross-modules. */
  async listerHistorique(limit = 50): Promise<ChangeLogEntry[]> {
    return listPedagogicalChanges(limit);
  }

  /** Annule une modification enregistrée. */
  async annulerModification(logId: string): Promise<RevertResult> {
    return revertPedagogicalChange(logId);
  }

  /** Propagation manuelle des IDs référentiel vers le journal. */
  async propagerCompetencesJournal(referentielIds: string[]): Promise<number> {
    return propagateReferentielIdsToJournal(referentielIds);
  }

  /** Résout et persiste les IDs référentiel pour une cellule. */
  async lierCompetencesCellule(cellId: string, labels: string[]): Promise<string[]> {
    return syncCellReferentielIds(cellId, labels);
  }
}

export const pedagogicalEngine = new PedagogicalEngine();

// Initialisation au chargement du module
pedagogicalEngine.initialize();
