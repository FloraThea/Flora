import { floraDb } from "@/lib/supabase/get-db";
import { onlyActive } from "@/lib/trash/active-query";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import type { ParsedLessonSequence, ParsedLessonSession } from "./lesson-document-parser";

export type LinkSuggestionTarget =
  | "programmation"
  | "progression"
  | "progression_row"
  | "sequence"
  | "sequence_session"
  | "journal"
  | "timetable"
  | "resource";

export type LinkSuggestion = {
  targetType: LinkSuggestionTarget;
  targetId: string;
  label: string;
  score: number;
  reasons: string[];
};

export type ImportLinkBundle = {
  programmations: LinkSuggestion[];
  progressions: LinkSuggestion[];
  progressionRows: LinkSuggestion[];
  sequences: LinkSuggestion[];
  sequenceSessions: LinkSuggestion[];
  resources: LinkSuggestion[];
};

function scoreMatch(input: {
  matiere?: string;
  sousMatiere?: string;
  niveau?: string;
  periodNumber?: number | null;
  weekNumbers?: number[];
  competence?: string;
  objectif?: string;
  candidate: Record<string, unknown>;
}): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const matiere = normalize(input.matiere ?? "");
  const candidateMatiere = normalize(String(input.candidate.matiere ?? input.candidate.subject ?? ""));

  if (matiere && candidateMatiere) {
    if (candidateMatiere.includes(matiere) || matiere.includes(candidateMatiere)) {
      score += 0.35;
      reasons.push("matière");
    }
  }

  const sousMatiere = normalize(input.sousMatiere ?? "");
  const candidateSous = normalize(String(input.candidate.sous_matiere ?? input.candidate.sub_subject ?? ""));
  if (sousMatiere && candidateSous && (candidateSous.includes(sousMatiere) || sousMatiere.includes(candidateSous))) {
    score += 0.15;
    reasons.push("sous-matière");
  }

  const niveau = normalize(input.niveau ?? "");
  const candidateNiveau = normalize(String(input.candidate.niveau ?? input.candidate.level ?? ""));
  if (niveau && candidateNiveau && (candidateNiveau.includes(niveau) || niveau.includes(candidateNiveau))) {
    score += 0.15;
    reasons.push("niveau");
  }

  if (
    input.periodNumber &&
    Number(input.candidate.period_number ?? input.candidate.periodNumber ?? 0) === input.periodNumber
  ) {
    score += 0.15;
    reasons.push("période");
  }

  const week = input.weekNumbers?.[0];
  const candidateWeek = Number(input.candidate.week_number ?? input.candidate.weekNumber ?? 0);
  if (week && candidateWeek === week) {
    score += 0.1;
    reasons.push("semaine");
  }

  const competence = normalize(input.competence ?? "");
  const candidateCompetence = normalize(String(input.candidate.competence_bo ?? input.candidate.competenceBo ?? ""));
  if (competence && candidateCompetence && candidateCompetence.includes(competence.slice(0, 12))) {
    score += 0.1;
    reasons.push("compétence");
  }

  return { score, reasons };
}

export async function suggestImportLinks(input: {
  matiere?: string;
  sousMatiere?: string;
  niveau?: string;
  periodNumber?: number | null;
  weekNumbers?: number[];
  competence?: string;
  objectif?: string;
}): Promise<ImportLinkBundle> {
  await requireTeacherScope();
  const db = await floraDb();

  const [programmations, progressions, progressionRows, sequences, sequenceSessions, resources] =
    await Promise.all([
      onlyActive(db.from("programmations").select("id,title,matiere,sous_matiere,niveau,periode")),
      onlyActive(
        db.from("progressions").select("id,title,matiere,sous_matiere,niveau,periode,programmation_id"),
      ),
      db
        .from("progression_rows")
        .select("id,period_number,week_number,competence_bo,seance_label,sequence_module,progression_tab_id"),
      onlyActive(
        db.from("sequences").select("id,title,matiere,sous_matiere,niveau,period_number,competence_bo"),
      ),
      db.from("sequence_sessions").select("id,sequence_id,title,objectif,session_number"),
      onlyActive(db.from("documents").select("id,title,matiere,resume")),
    ]);

  const mapSuggestions = (
    rows: Record<string, unknown>[] | null | undefined,
    targetType: LinkSuggestionTarget,
    labelField = "title",
  ): LinkSuggestion[] =>
    (rows ?? [])
      .map((row) => {
        const { score, reasons } = scoreMatch({ ...input, candidate: row });
        return {
          targetType,
          targetId: String(row.id),
          label: String(row[labelField] ?? row.seance_label ?? row.title ?? row.id),
          score,
          reasons,
        };
      })
      .filter((item) => item.score >= 0.25)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

  return {
    programmations: mapSuggestions(programmations.data as Record<string, unknown>[], "programmation"),
    progressions: mapSuggestions(progressions.data as Record<string, unknown>[], "progression"),
    progressionRows: mapSuggestions(
      (progressionRows.data as Record<string, unknown>[])?.map((row) => ({
        ...row,
        title: `${row.sequence_module ?? ""} ${row.seance_label ?? ""}`.trim(),
      })),
      "progression_row",
      "title",
    ),
    sequences: mapSuggestions(sequences.data as Record<string, unknown>[], "sequence"),
    sequenceSessions: mapSuggestions(
      (sequenceSessions.data as Record<string, unknown>[])?.map((row) => ({
        ...row,
        title: `Séance ${row.session_number} — ${row.title ?? ""}`,
      })),
      "sequence_session",
      "title",
    ),
    resources: mapSuggestions(resources.data as Record<string, unknown>[], "resource"),
  };
}

export function summarizeLinksForSequence(sequence: ParsedLessonSequence): string[] {
  const hints: string[] = [];
  if (sequence.matiere.value) hints.push(`matière=${sequence.matiere.value}`);
  if (sequence.periodNumber.value) hints.push(`période=${sequence.periodNumber.value}`);
  if (sequence.weekNumbers.value.length > 0) hints.push(`semaines=${sequence.weekNumbers.value.join(",")}`);
  if (sequence.competences.value.length > 0) hints.push(`compétences=${sequence.competences.value.length}`);
  return hints;
}

export function summarizeLinksForSession(session: ParsedLessonSession): string[] {
  const hints: string[] = [];
  if (session.competence.value) hints.push(`compétence=${session.competence.value.slice(0, 40)}`);
  if (session.objectif.value) hints.push(`objectif=${session.objectif.value.slice(0, 40)}`);
  return hints;
}
