import { getDb } from "@/lib/supabase/get-db";
import { computeProgressPercents } from "./ProgressCalculator";
import { teachingDashboard } from "./TeachingDashboard";
import type {
  JournalAdjustment,
  JournalEntry,
  JournalExportFormat,
  JournalExportVariant,
  JournalObservation,
  JournalPayload,
  JournalResources,
  StoredJournal,
} from "./types";

async function floraDb() {
  return getDb();
}

type ObservationSnapshot = {
  matiere: string;
  startTime: string;
  seanceId: string | null;
  observation: Omit<JournalObservation, "id" | "journalEntryId">;
};

async function snapshotObservations(journalId: string): Promise<ObservationSnapshot[]> {
  const payload = await loadJournalPayload(journalId);
  if (!payload) return [];

  return payload.entries
    .filter((entry) => entry.observation)
    .map((entry) => ({
      matiere: entry.matiere,
      startTime: entry.startTime,
      seanceId: entry.seanceId,
      observation: {
        status: entry.observation!.status,
        actualMinutes: entry.observation!.actualMinutes,
        comments: entry.observation!.comments,
        difficulties: entry.observation!.difficulties,
        successes: entry.observation!.successes,
        followUp: entry.observation!.followUp,
      },
    }));
}

async function restoreObservations(
  entries: JournalEntry[],
  snapshots: ObservationSnapshot[],
): Promise<void> {
  for (const snapshot of snapshots) {
    const entry = entries.find(
      (item) =>
        item.matiere === snapshot.matiere &&
        item.startTime === snapshot.startTime &&
        (snapshot.seanceId ? item.seanceId === snapshot.seanceId : true),
    );
    if (!entry) continue;

    await upsertObservation({
      journalEntryId: entry.id,
      ...snapshot.observation,
    });
  }
}

export async function refreshJournalDashboard(journalId: string): Promise<void> {
  const payload = await loadJournalPayload(journalId);
  if (!payload) return;

  const dashboard = teachingDashboard.build(payload.journal, payload.entries);
  const progress = await computeProgressPercents({
    schoolYear: payload.journal.schoolYear,
    periodNumber: payload.journal.periodNumber,
  });

  await (await floraDb())
    .from("journals")
    .update({
      dashboard: { ...dashboard, ...progress },
      updated_at: new Date().toISOString(),
    })
    .eq("id", journalId);
}

async function afterObservationSaved(
  journalEntryId: string,
  status: JournalObservation["status"],
): Promise<void> {
  const { data: entryRow } = await (await floraDb())
    .from("journal_entries")
    .select("journal_id, seance_id")
    .eq("id", journalEntryId)
    .maybeSingle();

  if (entryRow?.journal_id) {
    await refreshJournalDashboard(String(entryRow.journal_id));
  }

  if (entryRow?.seance_id) {
    await (await floraDb())
      .from("seances")
      .update({
        metadata: {
          journalStatus: status,
          journalUpdatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", entryRow.seance_id);
  }
}

function mapJournal(row: Record<string, unknown>): StoredJournal {
  return {
    id: String(row.id),
    teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
    schoolYear: String(row.school_year ?? ""),
    journalDate: String(row.journal_date ?? ""),
    className: String(row.class_name ?? ""),
    effectif: Number(row.effectif ?? 0),
    presents: Number(row.presents ?? 0),
    absents: (row.absents as string[]) ?? [],
    dailyProject: String(row.daily_project ?? ""),
    mainObjectives: (row.main_objectives as string[]) ?? [],
    importantInfo: String(row.important_info ?? ""),
    remarks: String(row.remarks ?? ""),
    periodNumber: Number(row.period_number ?? 0),
    weekNumber: Number(row.week_number ?? 0),
    status: String(row.status ?? "draft"),
    dashboard: (row.dashboard as StoredJournal["dashboard"]) ?? {
      plannedMinutes: 0,
      actualMinutes: 0,
      completedSessions: 0,
      remainingSessions: 0,
      completedRituals: 0,
      workedCompetences: [],
      remainingCompetences: [],
      periodProgressPercent: 0,
      annualProgressPercent: 0,
    },
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapEntry(row: Record<string, unknown>, observation?: JournalObservation | null): JournalEntry {
  return {
    id: String(row.id),
    journalId: String(row.journal_id),
    sortOrder: Number(row.sort_order ?? 0),
    entryType: row.entry_type as JournalEntry["entryType"],
    startTime: String(row.start_time ?? ""),
    endTime: String(row.end_time ?? ""),
    matiere: String(row.matiere ?? ""),
    seanceId: row.seance_id ? String(row.seance_id) : null,
    ritualId: row.ritual_id ? String(row.ritual_id) : null,
    ritualLabel: String(row.ritual_label ?? ""),
    competence: String(row.competence ?? ""),
    objectif: String(row.objectif ?? ""),
    dureeMinutes: Number(row.duree_minutes ?? 0),
    organisation: String(row.organisation ?? ""),
    materiel: (row.materiel as JournalEntry["materiel"]) ?? {
      items: [],
      guides: [],
      albums: [],
      fiches: [],
      jeux: [],
      autres: [],
    },
    documents: (row.documents as string[]) ?? [],
    resources: (row.resources as JournalResources) ?? {
      guides: [],
      albums: [],
      fiches: [],
      documents: [],
      jeux: [],
      videos: [],
      numeriques: [],
      liens: [],
    },
    observations: String(row.observations ?? ""),
    observation: observation ?? null,
    slotData: (row.slot_data as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

export async function findJournalByDate(
  date: string,
  teacherProfileId?: string | null,
): Promise<StoredJournal | null> {
  let query = (await floraDb()).from("journals").select("*").eq("journal_date", date);

  if (teacherProfileId) {
    query = query.eq("teacher_profile_id", teacherProfileId);
  }

  const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (error || !data) return null;
  return mapJournal(data);
}

export async function loadJournalPayload(journalId: string): Promise<JournalPayload | null> {
  const { data: journalRow, error } = await (await floraDb())
    .from("journals")
    .select("*")
    .eq("id", journalId)
    .maybeSingle();

  if (error || !journalRow) return null;

  const [{ data: entryRows }, { data: adjustmentRows }] = await Promise.all([
    (await floraDb())
      .from("journal_entries")
      .select("*")
      .eq("journal_id", journalId)
      .order("sort_order", { ascending: true }),
    (await floraDb()).from("journal_adjustments").select("*").eq("journal_id", journalId),
  ]);

  const entryIds = (entryRows ?? []).map((row) => String(row.id));
  const { data: observationRows } =
    entryIds.length > 0
      ? await (await floraDb()).from("journal_observations").select("*").in("journal_entry_id", entryIds)
      : { data: [] };

  const observationByEntry = new Map<string, JournalObservation>();
  for (const row of observationRows ?? []) {
    observationByEntry.set(String(row.journal_entry_id), {
      id: String(row.id),
      journalEntryId: String(row.journal_entry_id),
      status: row.status as JournalObservation["status"],
      actualMinutes: row.actual_minutes === null ? null : Number(row.actual_minutes),
      comments: String(row.comments ?? ""),
      difficulties: String(row.difficulties ?? ""),
      successes: String(row.successes ?? ""),
      followUp: String(row.follow_up ?? ""),
    });
  }

  return {
    journal: mapJournal(journalRow),
    entries: (entryRows ?? []).map((row) =>
      mapEntry(row, observationByEntry.get(String(row.id)) ?? null),
    ),
    adjustments: (adjustmentRows ?? []).map((row) => ({
      id: String(row.id),
      journalId: String(row.journal_id),
      proposedBy: String(row.proposed_by ?? "thea"),
      adjustmentType: String(row.adjustment_type ?? ""),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      payload: (row.payload as Record<string, unknown>) ?? {},
      status: row.status as JournalAdjustment["status"],
    })),
    calendar: null,
  };
}

export async function saveJournalPayload(input: {
  journal: Omit<StoredJournal, "id" | "created_at" | "updated_at"> & { id?: string };
  entries: Array<Omit<JournalEntry, "id" | "observation">>;
  preserveObservations?: boolean;
}): Promise<JournalPayload> {
  const journalPatch = {
    teacher_profile_id: input.journal.teacherProfileId,
    school_year: input.journal.schoolYear,
    journal_date: input.journal.journalDate,
    class_name: input.journal.className,
    effectif: input.journal.effectif,
    presents: input.journal.presents,
    absents: input.journal.absents,
    daily_project: input.journal.dailyProject,
    main_objectives: input.journal.mainObjectives,
    important_info: input.journal.importantInfo,
    remarks: input.journal.remarks,
    period_number: input.journal.periodNumber,
    week_number: input.journal.weekNumber,
    status: input.journal.status,
    dashboard: input.journal.dashboard,
    metadata: input.journal.metadata,
    updated_at: new Date().toISOString(),
  };

  let journalId = input.journal.id;
  const observationSnapshots =
    input.preserveObservations && journalId
      ? await snapshotObservations(journalId)
      : [];

  if (journalId) {
    const { error } = await (await floraDb()).from("journals").update(journalPatch).eq("id", journalId);
    if (error) throw new Error(error.message);
    await (await floraDb()).from("journal_entries").delete().eq("journal_id", journalId);
  } else {
    const { data, error } = await (await floraDb())
      .from("journals")
      .insert(journalPatch)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Impossible de créer le journal.");
    journalId = String(data.id);
  }

  const rows = input.entries.map((entry) => ({
    journal_id: journalId,
    sort_order: entry.sortOrder,
    entry_type: entry.entryType,
    start_time: entry.startTime,
    end_time: entry.endTime,
    matiere: entry.matiere,
    seance_id: entry.seanceId,
    ritual_id: entry.ritualId,
    ritual_label: entry.ritualLabel,
    competence: entry.competence,
    objectif: entry.objectif,
    duree_minutes: entry.dureeMinutes,
    organisation: entry.organisation,
    materiel: entry.materiel,
    documents: entry.documents,
    resources: entry.resources,
    observations: entry.observations,
    slot_data: entry.slotData,
    metadata: entry.metadata,
  }));

  if (rows.length > 0) {
    const { error } = await (await floraDb()).from("journal_entries").insert(rows);
    if (error) throw new Error(error.message);
  }

  if (observationSnapshots.length > 0) {
    const payload = await loadJournalPayload(journalId!);
    if (payload) {
      await restoreObservations(payload.entries, observationSnapshots);
    }
  }

  const payload = await loadJournalPayload(journalId!);
  if (!payload) throw new Error("Journal introuvable après enregistrement.");
  return payload;
}

export async function upsertObservation(input: {
  journalEntryId: string;
  status: JournalObservation["status"];
  actualMinutes?: number | null;
  comments?: string;
  difficulties?: string;
  successes?: string;
  followUp?: string;
}): Promise<JournalObservation> {
  const { data: existing } = await (await floraDb())
    .from("journal_observations")
    .select("id")
    .eq("journal_entry_id", input.journalEntryId)
    .maybeSingle();

  const patch = {
    journal_entry_id: input.journalEntryId,
    status: input.status,
    actual_minutes: input.actualMinutes ?? null,
    comments: input.comments ?? "",
    difficulties: input.difficulties ?? "",
    successes: input.successes ?? "",
    follow_up: input.followUp ?? "",
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { data, error } = await (await floraDb())
      .from("journal_observations")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Observation non enregistrée.");

    await afterObservationSaved(input.journalEntryId, input.status);

    return {
      id: String(data.id),
      journalEntryId: input.journalEntryId,
      status: data.status as JournalObservation["status"],
      actualMinutes: data.actual_minutes === null ? null : Number(data.actual_minutes),
      comments: String(data.comments ?? ""),
      difficulties: String(data.difficulties ?? ""),
      successes: String(data.successes ?? ""),
      followUp: String(data.follow_up ?? ""),
    };
  }

  const { data, error } = await (await floraDb())
    .from("journal_observations")
    .insert(patch)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Observation non enregistrée.");

  await afterObservationSaved(input.journalEntryId, input.status);

  return {
    id: String(data.id),
    journalEntryId: input.journalEntryId,
    status: data.status as JournalObservation["status"],
    actualMinutes: data.actual_minutes === null ? null : Number(data.actual_minutes),
    comments: String(data.comments ?? ""),
    difficulties: String(data.difficulties ?? ""),
    successes: String(data.successes ?? ""),
    followUp: String(data.follow_up ?? ""),
  };
}

export async function saveAdjustments(
  journalId: string,
  adjustments: Omit<JournalAdjustment, "id" | "journalId">[],
): Promise<void> {
  await (await floraDb()).from("journal_adjustments").delete().eq("journal_id", journalId).eq("status", "pending");

  if (adjustments.length === 0) return;

  const rows = adjustments.map((item) => ({
    journal_id: journalId,
    proposed_by: item.proposedBy,
    adjustment_type: item.adjustmentType,
    title: item.title,
    description: item.description,
    payload: item.payload,
    status: item.status,
  }));

  const { error } = await (await floraDb()).from("journal_adjustments").insert(rows);
  if (error) throw new Error(error.message);
}

export async function updateAdjustmentStatus(
  adjustmentId: string,
  status: JournalAdjustment["status"],
): Promise<void> {
  const { error } = await (await floraDb())
    .from("journal_adjustments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", adjustmentId);
  if (error) throw new Error(error.message);
}

export async function saveJournalExport(input: {
  journalId: string;
  exportFormat: JournalExportFormat;
  exportVariant: JournalExportVariant;
  content: string;
}): Promise<void> {
  const { error } = await (await floraDb()).from("journal_exports").insert({
    journal_id: input.journalId,
    export_format: input.exportFormat,
    export_variant: input.exportVariant,
    content: input.content,
  });
  if (error) throw new Error(error.message);
}

export async function listSeancesForJournal(input: {
  date: string;
  periodNumber: number;
  weekNumber: number;
  teacherProfileId?: string | null;
}): Promise<Record<string, unknown>[]> {
  let byDateQuery = (await floraDb()).from("seances").select("*").eq("session_date", input.date);
  if (input.teacherProfileId) {
    byDateQuery = byDateQuery.eq("teacher_profile_id", input.teacherProfileId);
  }

  const { data: byDate } = await byDateQuery;
  if (byDate && byDate.length > 0) return byDate;

  let byWeekQuery = (await floraDb())
    .from("seances")
    .select("*")
    .eq("period_number", input.periodNumber)
    .eq("week_number", input.weekNumber);

  if (input.teacherProfileId) {
    byWeekQuery = byWeekQuery.eq("teacher_profile_id", input.teacherProfileId);
  }

  const { data: byWeek } = await byWeekQuery;
  return byWeek ?? [];
}

export async function loadLibraryResourcesByMatiere(): Promise<Record<string, JournalResources>> {
  const { data: documents } = await (await floraDb())
    .from("documents")
    .select("id, title, matiere, document_type, methode, resume")
    .eq("status", "analysed");

  const grouped: Record<string, JournalResources> = {};

  for (const document of documents ?? []) {
    const matiere = String(document.matiere ?? "Autre").toLowerCase();
    if (!grouped[matiere]) {
      grouped[matiere] = {
        guides: [],
        albums: [],
        fiches: [],
        documents: [],
        jeux: [],
        videos: [],
        numeriques: [],
        liens: [],
      };
    }

    const bucket = grouped[matiere];
    const title = String(document.title ?? "");
    const type = String(document.document_type ?? "").toLowerCase();

    if (type.includes("guide")) bucket.guides.push(title);
    else if (type.includes("album")) bucket.albums.push(title);
    else if (type.includes("fiche")) bucket.fiches.push(title);
    else if (type.includes("jeu")) bucket.jeux.push(title);
    else if (type.includes("video")) bucket.videos.push(title);
    else bucket.documents.push(title);
  }

  return grouped;
}

export async function listJournalsInRange(
  startDate: string,
  endDate: string,
  teacherProfileId?: string | null,
): Promise<StoredJournal[]> {
  let query = (await floraDb())
    .from("journals")
    .select("*")
    .gte("journal_date", startDate)
    .lte("journal_date", endDate);

  if (teacherProfileId) {
    query = query.eq("teacher_profile_id", teacherProfileId);
  }

  const { data, error } = await query.order("journal_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapJournal);
}
