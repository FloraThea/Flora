"use client";

import { FloraBadge } from "@/components/ui/FloraBadge";

type HierarchyEntity = {
  id: string;
  entity_type: string;
  label: string;
  content: string;
  metadata?: Record<string, unknown>;
};

type DocumentHierarchyViewProps = {
  entities: HierarchyEntity[];
  extractionMethod?: string;
};

export function DocumentHierarchyView({
  entities,
  extractionMethod,
}: DocumentHierarchyViewProps) {
  if (entities.length === 0) return null;

  const ordered = [...entities].sort((left, right) => {
    const leftModule = Number(left.metadata?.moduleNumber ?? 0);
    const rightModule = Number(right.metadata?.moduleNumber ?? 0);
    if (leftModule !== rightModule) return leftModule - rightModule;
    const leftSeance = Number(left.metadata?.seanceNumber ?? 0);
    const rightSeance = Number(right.metadata?.seanceNumber ?? 0);
    return leftSeance - rightSeance;
  });

  const modules = ordered.filter((entity) => entity.entity_type === "module");
  const introduction = ordered.find(
    (entity) => entity.entity_type === "partie" && /introduction/i.test(entity.label),
  );
  const seancesByModule = new Map<number, HierarchyEntity[]>();

  for (const entity of ordered.filter((item) => item.entity_type === "seance")) {
    const moduleNumber = Number(entity.metadata?.moduleNumber ?? 0);
    const list = seancesByModule.get(moduleNumber) ?? [];
    list.push(entity);
    seancesByModule.set(moduleNumber, list);
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-serif text-xl font-medium text-flora-text">
          Structure fidèle du guide
        </h3>
        {extractionMethod === "faithful" ? (
          <FloraBadge accent="sage" size="sm">
            Extraction fidèle
          </FloraBadge>
        ) : null}
      </div>

      {introduction ? (
        <article className="mb-4 rounded-2xl border border-white/70 bg-white/45 px-4 py-4">
          <p className="mb-2 font-serif text-lg font-medium">{introduction.label}</p>
          <p className="whitespace-pre-wrap text-sm font-light leading-relaxed text-flora-text-muted">
            {introduction.content.length > 1500
              ? `${introduction.content.slice(0, 1500)}…`
              : introduction.content}
          </p>
        </article>
      ) : null}

      <div className="flex flex-col gap-4">
        {modules.map((module) => (
          <article key={module.id} className="rounded-2xl border border-white/70 bg-white/45 px-4 py-4">
            <p className="mb-3 font-serif text-xl font-medium">{module.label}</p>
            <div className="flex flex-col gap-3">
              {(seancesByModule.get(Number(module.metadata?.moduleNumber ?? 0)) ?? []).map(
                (seance) => (
                  <div key={seance.id} className="rounded-xl border border-white/60 bg-white/50 px-3 py-3">
                    <p className="font-medium text-flora-text">{seance.label}</p>
                    {seance.content ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm font-light leading-relaxed text-flora-text-muted">
                        {seance.content.length > 800
                          ? `${seance.content.slice(0, 800)}…`
                          : seance.content}
                      </p>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
