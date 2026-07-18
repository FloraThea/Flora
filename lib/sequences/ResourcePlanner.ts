import { floraDb } from "@/lib/supabase/get-db";
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
  }> {
    const selected = await this.loadLinkedResources(context);
    const labels = [
      ...context.row.resources,
      ...selected.map((resource) => resource.title),
    ].filter((value, index, array) => array.indexOf(value) === index);

    return {
      resources: labels,
      resourceIds: selected.map((resource) => resource.documentId),
      materiel: context.row.materiel,
      vocabulaire: context.row.objectifs.filter((objectif) =>
        /vocabulaire|lexique|mot/i.test(objectif),
      ),
    };
  }

  private async loadLinkedResources(context: SequenceContext): Promise<ResourceContext[]> {
    const ids = context.row.resourceIds;
    if (ids.length === 0) {
      return context.resources.filter((resource) =>
        resource.matiere.toLowerCase().includes(context.tab.subjectLabel.toLowerCase()),
      );
    }

    const { data: documents } = await (await floraDb())
      .from("documents")
      .select("id, title, matiere, methode, document_type")
      .in("id", ids);

    const resources: ResourceContext[] = [];

    for (const document of documents ?? []) {
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

    return resources;
  }
}

export const resourcePlanner = new ResourcePlanner();
