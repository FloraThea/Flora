import "server-only";

import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { floraDb } from "@/lib/supabase/get-db";
import { enrichJournalPayload } from "./journal-view-flags";
import { journalEntryGenerator } from "./JournalEntryGenerator";
import { journalGenerator } from "./JournalGenerator";
import {
  findJournalByDate,
  loadJournalPayload,
  refreshJournalDashboard,
} from "./journal-service";
import type { JournalEntry, JournalMateriel, JournalPayload, JournalResources } from "./types";


export type JournalEntryRef = {
  entryId?: string;
  sortOrder?: number;
  startTime?: string;
  matiere?: string;
};

export type CompleteJournalEntryInput = {
  date: string;
  entryRef: JournalEntryRef;
  startTime?: string;
  endTime?: string;
  matiere?: string;
  subSubject?: string;
  competence?: string;
  objectif?: string;
  organisation?: string;
  materielItems?: string[];
  resourceItems?: string[];
  observations?: string;
};

export type GenerateJournalEntryInput = {
  date: string;
  entryRef: JournalEntryRef;
  theme?: string;
  objectifSouhaite?: string;
};

function emptyResources(): JournalResources {
  return {
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

function emptyMateriel(): JournalMateriel {
  return {
    items: [],
    guides: [],
    albums: [],
    fiches: [],
    jeux: [],
    autres: [],
  };
}

function resolveEntry(entries: JournalEntry[], ref: JournalEntryRef): JournalEntry | null {
  if (ref.entryId && !ref.entryId.startsWith("preview-")) {
    const byId = entries.find((entry) => entry.id === ref.entryId);
    if (byId) return byId;
  }

  return (
    entries.find(
      (entry) =>
        entry.sortOrder === ref.sortOrder &&
        entry.startTime === ref.startTime &&
        entry.matiere === ref.matiere,
    ) ?? null
  );
}

async function assertEntryOwnedByProfile(entryId: string, teacherProfileId: string): Promise<void> {
  const { data: entryRow, error: entryError } = await (await floraDb())
    .from("journal_entries")
    .select("journal_id")
    .eq("id", entryId)
    .maybeSingle();

  if (entryError || !entryRow) {
    throw new Error("Créneau introuvable.");
  }

  const { data: journalRow, error: journalError } = await (await floraDb())
    .from("journals")
    .select("teacher_profile_id")
    .eq("id", entryRow.journal_id)
    .maybeSingle();

  if (journalError || !journalRow || journalRow.teacher_profile_id !== teacherProfileId) {
    throw new Error("Accès refusé à ce créneau.");
  }
}

export async function ensureJournalForDate(date: string): Promise<JournalPayload> {
  const profileBundle = await loadTeacherProfileBundle();
  if (!profileBundle) {
    throw new Error("Profil enseignant requis.");
  }

  const existing = await findJournalByDate(date, profileBundle.profile.id);
  if (existing) {
    const payload = await loadJournalPayload(existing.id);
    if (payload) return payload;
  }

  return journalGenerator.generateForDate({ date, persist: true });
}

async function patchJournalEntry(
  entry: JournalEntry,
  patch: Record<string, unknown>,
  teacherProfileId: string,
): Promise<void> {
  await assertEntryOwnedByProfile(entry.id, teacherProfileId);

  const { error } = await (await floraDb()).from("journal_entries").update(patch).eq("id", entry.id);

  if (error) throw new Error(error.message);
}

export async function completeJournalEntry(input: CompleteJournalEntryInput): Promise<JournalPayload> {
  const profileBundle = await loadTeacherProfileBundle();
  if (!profileBundle) throw new Error("Profil enseignant requis.");

  const payload = await ensureJournalForDate(input.date);
  const entry = resolveEntry(payload.entries, input.entryRef);
  if (!entry) throw new Error("Créneau introuvable dans le cahier journal.");

  const slotData = { ...entry.slotData };
  if (input.subSubject !== undefined) {
    slotData.subSubject = input.subSubject;
  }

  const materiel = {
    ...emptyMateriel(),
    ...entry.materiel,
    items: input.materielItems ?? entry.materiel.items,
  };

  const resources = {
    ...emptyResources(),
    ...entry.resources,
    documents: input.resourceItems ?? entry.resources.documents,
  };

  await patchJournalEntry(
    entry,
    {
      start_time: input.startTime ?? entry.startTime,
      end_time: input.endTime ?? entry.endTime,
      matiere: input.matiere ?? entry.matiere,
      competence: input.competence ?? entry.competence,
      objectif: input.objectif ?? entry.objectif,
      organisation: input.organisation ?? entry.organisation,
      materiel,
      resources,
      observations: input.observations ?? entry.observations,
      slot_data: slotData,
      metadata: {
        ...entry.metadata,
        fillState: "manual",
        completedAt: new Date().toISOString(),
      },
    },
    profileBundle.profile.id,
  );

  await refreshJournalDashboard(payload.journal.id);
  const updated = await loadJournalPayload(payload.journal.id);
  if (!updated) throw new Error("Cahier journal introuvable après mise à jour.");
  return enrichJournalPayload(updated);
}

export async function generateJournalEntry(input: GenerateJournalEntryInput): Promise<JournalPayload> {
  const profileBundle = await loadTeacherProfileBundle();
  if (!profileBundle) throw new Error("Profil enseignant requis.");

  const payload = await ensureJournalForDate(input.date);
  const entry = resolveEntry(payload.entries, input.entryRef);
  if (!entry) throw new Error("Créneau introuvable dans le cahier journal.");

  const generated = await journalEntryGenerator.generateForSlot({
    date: input.date,
    entry,
    hints: {
      theme: input.theme,
      objectifSouhaite: input.objectifSouhaite,
    },
  });

  const materiel = {
    ...emptyMateriel(),
    items: generated.materiel,
  };

  const resources = {
    ...emptyResources(),
    documents: generated.resources,
  };

  await patchJournalEntry(
    entry,
    {
      competence: generated.competence,
      objectif: generated.objectif,
      organisation: generated.organisation,
      materiel,
      resources,
      observations: generated.observations,
      metadata: {
        ...entry.metadata,
        fillState: "generated",
        generatedAt: new Date().toISOString(),
        generatedBy: "thea",
      },
    },
    profileBundle.profile.id,
  );

  await refreshJournalDashboard(payload.journal.id);
  const updated = await loadJournalPayload(payload.journal.id);
  if (!updated) throw new Error("Cahier journal introuvable après génération.");
  return enrichJournalPayload(updated);
}
