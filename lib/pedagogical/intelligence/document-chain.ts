import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { onlyActive } from "@/lib/trash/active-query";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import type { DocumentChainNode } from "./types";

export async function buildDocumentChain(input: {
  module: "programmation" | "progression" | "sequence" | "seance";
  entityId: string;
}): Promise<{ root: { module: string; entityId: string; title: string }; chain: DocumentChainNode[] }> {
  const scope = await requireTeacherScope();
  const chain: DocumentChainNode[] = [];

  if (input.module === "seance") {
    const { data: seance } = await onlyActive(
      (await floraDb()).from("seances").select("*").eq("id", input.entityId),
    ).maybeSingle();
    if (!seance || seance.teacher_profile_id !== scope.profileId) {
      throw new Error("Séance introuvable.");
    }

    chain.push({
      module: "seances",
      entityId: String(seance.id),
      title: String(seance.title),
      href: `/seances?id=${seance.id}`,
      matiere: String(seance.matiere ?? ""),
    });

    if (seance.sequence_id) {
      const { data: sequence } = await (await floraDb())
        .from("sequences")
        .select("id, title, progression_id, progression_row_id, matiere")
        .eq("id", seance.sequence_id)
        .maybeSingle();
      if (sequence) {
        chain.unshift({
          module: "sequence",
          entityId: String(sequence.id),
          title: String(sequence.title),
          href: `/sequences?id=${sequence.id}`,
          matiere: String(sequence.matiere ?? ""),
        });
        await appendProgressionChain(chain, String(sequence.progression_id), String(sequence.progression_row_id));
      }
    }

    return {
      root: { module: "seance", entityId: input.entityId, title: String(seance.title) },
      chain: await enrichChain(chain, { seanceIds: [String(seance.id)] }),
    };
  }

  if (input.module === "progression") {
    const { data: progression } = await onlyActive(
      (await floraDb()).from("progressions").select("*").eq("id", input.entityId),
    ).maybeSingle();
    if (!progression || progression.teacher_profile_id !== scope.profileId) {
      throw new Error("Progression introuvable.");
    }

    chain.push({
      module: "progression",
      entityId: String(progression.id),
      title: String(progression.title),
      href: `/progression?id=${progression.id}`,
      matiere: String(progression.matiere ?? ""),
    });

    if (progression.programmation_id) {
      const { data: prog } = await (await floraDb())
        .from("programmations")
        .select("id, title, matiere")
        .eq("id", progression.programmation_id)
        .maybeSingle();
      if (prog) {
        chain.unshift({
          module: "programmation",
          entityId: String(prog.id),
          title: String(prog.title),
          href: `/programmation?id=${prog.id}`,
          matiere: String(prog.matiere ?? ""),
        });
      }
    }

    const { data: linkedSeances } = await onlyActive(
      (await floraDb()).from("seances").select("id").eq("progression_id", progression.id).limit(5),
    );

    return {
      root: { module: "progression", entityId: input.entityId, title: String(progression.title) },
      chain: await enrichChain(chain, {
        seanceIds: (linkedSeances ?? []).map((row) => String(row.id)),
        programmationId: progression.programmation_id ? String(progression.programmation_id) : undefined,
      }),
    };
  }

  if (input.module === "programmation") {
    const { data: prog } = await onlyActive(
      (await floraDb()).from("programmations").select("*").eq("id", input.entityId),
    ).maybeSingle();
    if (!prog || prog.teacher_profile_id !== scope.profileId) {
      throw new Error("Programmation introuvable.");
    }

    chain.push({
      module: "programmation",
      entityId: String(prog.id),
      title: String(prog.title),
      href: `/programmation?id=${prog.id}`,
      matiere: String(prog.matiere ?? ""),
    });

    const { data: progressions } = await onlyActive(
      (await floraDb()).from("progressions").select("id, title, matiere").eq("programmation_id", prog.id),
    );
    for (const progression of progressions ?? []) {
      chain.push({
        module: "progression",
        entityId: String(progression.id),
        title: String(progression.title),
        href: `/progression?id=${progression.id}`,
        matiere: String(progression.matiere ?? ""),
      });
    }

    return {
      root: { module: "programmation", entityId: input.entityId, title: String(prog.title) },
      chain: await enrichChain(chain, { programmationId: String(prog.id) }),
    };
  }

  const { data: sequence } = await onlyActive(
    (await floraDb()).from("sequences").select("*").eq("id", input.entityId),
  ).maybeSingle();
  if (!sequence || sequence.teacher_profile_id !== scope.profileId) {
    throw new Error("Séquence introuvable.");
  }

  chain.push({
    module: "sequence",
    entityId: String(sequence.id),
    title: String(sequence.title),
    href: `/sequences?id=${sequence.id}`,
    matiere: String(sequence.matiere ?? ""),
  });
  await appendProgressionChain(chain, String(sequence.progression_id), String(sequence.progression_row_id));

  const { data: seances } = await onlyActive(
    (await floraDb()).from("seances").select("id, title, matiere").eq("sequence_id", sequence.id),
  );
  for (const seance of seances ?? []) {
    chain.push({
      module: "seances",
      entityId: String(seance.id),
      title: String(seance.title),
      href: `/seances?id=${seance.id}`,
      matiere: String(seance.matiere ?? ""),
    });
  }

  return { root: { module: "sequence", entityId: input.entityId, title: String(sequence.title) }, chain: await enrichChain(chain, { seanceIds: (seances ?? []).map((row) => String(row.id)) }) };
}

export async function buildDocumentChainByCompetence(competence: string): Promise<{
  root: { module: string; entityId: string; title: string };
  chain: DocumentChainNode[];
}> {
  const scope = await requireTeacherScope();
  const label = competence.trim();
  if (!label) throw new Error("Compétence requise.");

  const { data: row } = await (await floraDb())
    .from("progression_rows")
    .select("id, progression_id, competence_bo")
    .ilike("competence_bo", `%${label}%`)
    .limit(1)
    .maybeSingle();

  if (row) {
    const { data: progression } = await onlyActive(
      (await floraDb()).from("progressions").select("id, title").eq("id", row.progression_id),
    ).maybeSingle();
    if (progression) {
      return buildDocumentChain({ module: "progression", entityId: String(progression.id) });
    }
  }

  const { data: seance } = await (await floraDb())
    .from("seances")
    .select("id, title, competence_bo")
    .eq("teacher_profile_id", scope.profileId)
    .is("deleted_at", null)
    .ilike("competence_bo", `%${label}%`)
    .limit(1)
    .maybeSingle();

  if (seance) {
    return buildDocumentChain({ module: "seance", entityId: String(seance.id) });
  }

  return {
    root: { module: "referentiel", entityId: label, title: label },
    chain: [{ module: "referentiel", entityId: label, title: label, href: `/referentiel-bo?q=${encodeURIComponent(label)}` }],
  };
}

async function enrichChain(
  chain: DocumentChainNode[],
  context: { seanceIds?: string[]; programmationId?: string },
): Promise<DocumentChainNode[]> {
  const enriched = [...chain];

  for (const seanceId of context.seanceIds ?? []) {
    const { data: seance } = await (await floraDb())
      .from("seances")
      .select("resources, resource_ids, period_number, week_number, session_date")
      .eq("id", seanceId)
      .maybeSingle();
    if (!seance) continue;

    const resources = (seance.resources as Array<{ title?: string; id?: string }>) ?? [];
    for (const resource of resources.slice(0, 3)) {
      enriched.push({
        module: "ressources",
        entityId: String(resource.id ?? seanceId),
        title: String(resource.title ?? "Ressource"),
        href: `/bibliotheque?q=${encodeURIComponent(String(resource.title ?? ""))}`,
      });
    }

    const journalDate = seance.session_date ? String(seance.session_date) : "";
    enriched.push({
      module: "cahier_journal",
      entityId: seanceId,
      title: journalDate ? `Cahier journal · ${journalDate}` : `Cahier journal · P${seance.period_number} S${seance.week_number}`,
      href: journalDate
        ? `/cahier-journal?date=${journalDate}`
        : `/cahier-journal?period=${seance.period_number}&week=${seance.week_number}`,
    });
  }

  if (context.programmationId) {
    enriched.push({
      module: "cahier_journal",
      entityId: context.programmationId,
      title: "Cahier journal · programmation",
      href: `/cahier-journal?programmationId=${context.programmationId}`,
    });
  }

  return enriched;
}

async function appendProgressionChain(
  chain: DocumentChainNode[],
  progressionId: string,
  progressionRowId: string,
) {
  if (!progressionId) return;
  const { data: progression } = await (await floraDb())
    .from("progressions")
    .select("id, title, matiere, programmation_id")
    .eq("id", progressionId)
    .maybeSingle();
  if (progression) {
    chain.unshift({
      module: "progression",
      entityId: String(progression.id),
      title: String(progression.title),
      href: `/progression?id=${progression.id}`,
      matiere: String(progression.matiere ?? ""),
    });
    if (progression.programmation_id) {
      const { data: prog } = await (await floraDb())
        .from("programmations")
        .select("id, title, matiere")
        .eq("id", progression.programmation_id)
        .maybeSingle();
      if (prog) {
        chain.unshift({
          module: "programmation",
          entityId: String(prog.id),
          title: String(prog.title),
          href: `/programmation?id=${prog.id}`,
          matiere: String(prog.matiere ?? ""),
        });
      }
    }
  }
  void progressionRowId;
}
