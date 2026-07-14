/**
 * Mise en page des cartes export EDT — lisibilité classe (police fixe, pas de réduction).
 */

/** Texte complémentaire court → même ligne que la matière. */
export const EXPORT_COMPLEMENTARY_INLINE_MAX_CHARS = 18;
export const EXPORT_SUBJECT_COMPLEMENTARY_INLINE_MAX_TOTAL = 38;

export type ExportCardBlock =
  | { kind: "time"; text: string }
  | { kind: "subjectInline"; subject: string; complementary: string }
  | { kind: "subject"; text: string }
  | { kind: "complementary"; text: string; maxLines: number }
  | { kind: "subSubject"; text: string }
  | { kind: "extra"; text: string };

export function shouldRenderComplementaryInline(subject: string, complementary: string): boolean {
  if (!complementary.trim()) return false;
  const comp = complementary.trim();
  if (comp.length > EXPORT_COMPLEMENTARY_INLINE_MAX_CHARS) return false;
  const total = subject.trim().length + comp.length + 3;
  return total <= EXPORT_SUBJECT_COMPLEMENTARY_INLINE_MAX_TOTAL;
}

/**
 * Ordre : horaires → matière (+ complémentaire inline ou dessous) → sous-matière → extras.
 * Aucune ligne vide si le champ est absent.
 */
export function buildClassroomExportCardBlocks(input: {
  timeLabel: string;
  subject: string;
  subSubject?: string;
  complementaryText?: string;
  showComplementaryText: boolean;
  objectif?: string;
  competence?: string;
  showObjectives?: boolean;
  showCompetencies?: boolean;
}): ExportCardBlock[] {
  const blocks: ExportCardBlock[] = [];
  const subject = input.subject.trim() || "Créneau";
  const subSubject = input.subSubject?.trim() ?? "";
  const complementary = input.showComplementaryText ? input.complementaryText?.trim() ?? "" : "";

  blocks.push({ kind: "time", text: input.timeLabel });

  if (complementary) {
    if (shouldRenderComplementaryInline(subject, complementary)) {
      blocks.push({ kind: "subjectInline", subject, complementary });
    } else {
      blocks.push({ kind: "subject", text: subject });
      blocks.push({ kind: "complementary", text: complementary, maxLines: 2 });
    }
  } else {
    blocks.push({ kind: "subject", text: subject });
  }

  if (subSubject) {
    blocks.push({ kind: "subSubject", text: subSubject });
  }

  if (input.showObjectives && input.objectif?.trim()) {
    blocks.push({ kind: "extra", text: input.objectif.trim() });
  }
  if (input.showCompetencies && input.competence?.trim()) {
    blocks.push({ kind: "extra", text: input.competence.trim() });
  }

  return blocks;
}
