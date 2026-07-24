import type { ResourceContext } from "@/lib/programming/types";
import { floraDb } from "@/lib/supabase/get-db";

export type LibraryGenerationContext = {
  methode?: string;
  matiere?: string;
  resourceIds?: string[];
  moduleLabel?: string;
  seanceLabel?: string;
  sourcePath?: string;
};

export type LibraryEntityMatch = {
  documentId: string;
  documentTitle: string;
  entityId: string;
  entityType: string;
  label: string;
  content: string;
  sourceText: string;
  sourcePath?: string;
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function moduleNumberFromLabel(label: string): number | null {
  const match = label.match(/module\s+(\d+)/i);
  return match ? Number.parseInt(match[1] ?? "0", 10) : null;
}

function seanceNumberFromLabel(label: string): number | null {
  const match = label.match(/s[ée]ance\s+(\d+)/i);
  return match ? Number.parseInt(match[1] ?? "0", 10) : null;
}

function scoreEntityMatch(
  entity: { label: string; entity_type: string; content: string; metadata?: Record<string, unknown> | null },
  context: LibraryGenerationContext,
): number {
  let score = 0;
  const entityLabel = normalizeKey(entity.label);
  const entityPath = normalizeKey(String(entity.metadata?.sourcePath ?? ""));

  if (context.moduleLabel) {
    const moduleNumber = moduleNumberFromLabel(context.moduleLabel);
    const entityModuleNumber = moduleNumberFromLabel(entity.label);
    if (moduleNumber && entityModuleNumber === moduleNumber) score += 0.45;
    if (entityLabel.includes(normalizeKey(context.moduleLabel))) score += 0.25;
  }

  if (context.seanceLabel) {
    const seanceNumber = seanceNumberFromLabel(context.seanceLabel);
    const entitySeanceNumber = seanceNumberFromLabel(entity.label);
    if (seanceNumber && entitySeanceNumber === seanceNumber) score += 0.35;
    if (entityLabel.includes(normalizeKey(context.seanceLabel))) score += 0.2;
  }

  if (context.sourcePath && entityPath.includes(normalizeKey(context.sourcePath))) {
    score += 0.3;
  }

  if (entity.entity_type === "seance" && context.seanceLabel) score += 0.1;
  if (entity.entity_type === "module" && context.moduleLabel && !context.seanceLabel) score += 0.1;

  return score;
}

/**
 * Charge les ressources bibliothèque en priorisant les documents analysés fidèlement.
 */
export async function loadLibraryResourcesForGeneration(
  context: LibraryGenerationContext,
): Promise<ResourceContext[]> {
  let query = (await floraDb())
    .from("documents")
    .select("id, title, matiere, methode, document_type, metadata")
    .eq("status", "analysed");

  if (context.resourceIds?.length) {
    query = query.in("id", context.resourceIds);
  }

  const { data: documents } = await query;

  const resources: ResourceContext[] = [];

  for (const document of documents ?? []) {
    const metadata = (document.metadata ?? {}) as Record<string, unknown>;
    if (metadata.archived) continue;

    const docMethode = String(document.methode ?? "").toLowerCase();
    const docMatiere = String(document.matiere ?? "").toLowerCase();
    const methodeKey = (context.methode ?? "").toLowerCase();
    const matiereKey = (context.matiere ?? "").toLowerCase();

    if (context.resourceIds?.length) {
      // IDs explicites : pas de filtre matière/méthode.
    } else if (methodeKey && !docMethode.includes(methodeKey) && matiereKey && !docMatiere.includes(matiereKey)) {
      continue;
    } else if (methodeKey && !docMethode.includes(methodeKey) && !matiereKey) {
      continue;
    } else if (matiereKey && !docMatiere.includes(matiereKey) && !methodeKey) {
      continue;
    }

    const [{ data: competences }, { data: entities }] = await Promise.all([
      (await floraDb()).from("document_competences").select("competence").eq("document_id", document.id),
      (await floraDb())
        .from("pedagogical_entities")
        .select("label, entity_type")
        .eq("document_id", document.id),
    ]);

    resources.push({
      documentId: document.id,
      title: document.title || "Ressource",
      matiere: document.matiere ?? "",
      methode: document.methode ?? "",
      documentType: document.document_type ?? "",
      competences: (competences ?? []).map((item) => item.competence).filter(Boolean),
      notions: (entities ?? [])
        .filter((item) => item.entity_type === "notion")
        .map((item) => item.label),
      modules: (entities ?? [])
        .filter((item) => item.entity_type === "module")
        .map((item) => item.label),
    });
  }

  return resources.sort((left, right) => {
    const leftDoc = documents?.find((doc) => doc.id === left.documentId);
    const rightDoc = documents?.find((doc) => doc.id === right.documentId);
    const leftFaithful =
      (leftDoc?.metadata as Record<string, unknown> | null)?.extraction_method === "faithful" ? 1 : 0;
    const rightFaithful =
      (rightDoc?.metadata as Record<string, unknown> | null)?.extraction_method === "faithful" ? 1 : 0;
    return rightFaithful - leftFaithful;
  });
}

/**
 * Retrouve le contenu documentaire le plus pertinent pour un module / une séance.
 */
export async function findLibraryEntityMatches(
  context: LibraryGenerationContext,
): Promise<LibraryEntityMatch[]> {
  const resources = await loadLibraryResourcesForGeneration(context);
  if (resources.length === 0) return [];

  const documentIds = resources.map((resource) => resource.documentId);
  const { data: entities } = await (await floraDb())
    .from("pedagogical_entities")
    .select("id, document_id, entity_type, label, content, source_text, metadata")
    .in("document_id", documentIds);

  const scored = (entities ?? [])
    .map((entity) => ({
      entity,
      score: scoreEntityMatch(
        {
          label: entity.label,
          entity_type: entity.entity_type,
          content: entity.content,
          metadata: entity.metadata as Record<string, unknown> | null,
        },
        context,
      ),
    }))
    .filter((item) => item.score >= 0.45)
    .sort((left, right) => right.score - left.score);

  const titleById = new Map(resources.map((resource) => [resource.documentId, resource.title]));

  return scored.slice(0, 5).map(({ entity }) => ({
    documentId: entity.document_id,
    documentTitle: titleById.get(entity.document_id) ?? "Document",
    entityId: entity.id,
    entityType: entity.entity_type,
    label: entity.label,
    content: entity.content,
    sourceText: entity.source_text,
    sourcePath: String((entity.metadata as Record<string, unknown> | null)?.sourcePath ?? ""),
  }));
}

export function buildProvenanceMetadata(input: {
  matches: LibraryEntityMatch[];
  moduleLabel?: string;
  seanceLabel?: string;
  sourcePath?: string;
}): Record<string, unknown> {
  const primary = input.matches[0];
  return {
    sourceDocumentId: primary?.documentId,
    sourceDocumentTitle: primary?.documentTitle,
    sourceEntityId: primary?.entityId,
    sourcePath:
      input.sourcePath ??
      [primary?.documentTitle, input.moduleLabel, input.seanceLabel].filter(Boolean).join(" > "),
    libraryMatchCount: input.matches.length,
  };
}
