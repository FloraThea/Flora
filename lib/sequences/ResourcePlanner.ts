import {
  buildProvenanceMetadata,
  findLibraryEntityMatches,
  loadLibraryResourcesForGeneration,
} from "@/lib/pedagogical/library-context";
import type { LibraryEntityMatch } from "@/lib/pedagogical/library-context";
import type { ResourceContext } from "@/lib/programming/types";
import type { SequenceContext } from "./types";

/**
 * Planifie les ressources pédagogiques à partir de la bibliothèque et de la progression.
 */
export class ResourcePlanner {
  async plan(context: SequenceContext): Promise<{
    resources: string[];
    resourceIds: string[];
    materiel: string[];
    vocabulaire: string[];
    libraryMatches: LibraryEntityMatch[];
    provenance: Record<string, unknown>;
  }> {
    const libraryContext = {
      methode: context.methode,
      matiere: context.tab.subjectLabel,
      resourceIds: context.row.resourceIds,
      moduleLabel: context.row.sequenceModule,
      seanceLabel: context.row.seanceLabel,
      sourcePath: String(context.row.metadata?.sourcePath ?? ""),
    };

    const selected = await this.loadLinkedResources(context);
    const libraryMatches = await findLibraryEntityMatches(libraryContext);
    const provenance = buildProvenanceMetadata({
      matches: libraryMatches,
      moduleLabel: context.row.sequenceModule,
      seanceLabel: context.row.seanceLabel,
      sourcePath: String(context.row.metadata?.sourcePath ?? ""),
    });

    const labels = [
      ...context.row.resources,
      ...selected.map((resource) => resource.title),
      ...libraryMatches.map((match) => match.documentTitle),
    ].filter((value, index, array) => array.indexOf(value) === index);

    const materielFromLibrary = libraryMatches
      .filter((match) => match.entityType === "materiel")
      .map((match) => match.label);

    return {
      resources: labels,
      resourceIds:
        libraryMatches.length > 0
          ? [...new Set(libraryMatches.map((match) => match.documentId))]
          : selected.map((resource) => resource.documentId),
      materiel: [...context.row.materiel, ...materielFromLibrary],
      vocabulaire: context.row.objectifs.filter((objectif) =>
        /vocabulaire|lexique|mot/i.test(objectif),
      ),
      libraryMatches,
      provenance,
    };
  }

  private async loadLinkedResources(context: SequenceContext): Promise<ResourceContext[]> {
    if (context.resources.length > 0) return context.resources;

    return loadLibraryResourcesForGeneration({
      methode: context.methode,
      matiere: context.tab.subjectLabel,
      resourceIds: context.row.resourceIds.length > 0 ? context.row.resourceIds : undefined,
      moduleLabel: context.row.sequenceModule,
      seanceLabel: context.row.seanceLabel,
      sourcePath: String(context.row.metadata?.sourcePath ?? ""),
    });
  }
}

export const resourcePlanner = new ResourcePlanner();
