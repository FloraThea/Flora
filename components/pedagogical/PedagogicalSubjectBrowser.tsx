"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { useSubjectNavigation } from "@/lib/hooks/useSubjectNavigation";
import {
  subjectTabLabel,
  type PedagogicalModuleKey,
} from "@/lib/pedagogical/subject-navigation";
import { SUBJECT_ALL, SUBJECT_NONE } from "@/lib/pedagogical/subjects";
import {
  PedagogicalDocumentCard,
  type PedagogicalDocumentListItem,
} from "./PedagogicalDocumentCard";
import { SubSubjectTabBar } from "./SubSubjectTabBar";
import { SubjectDividerTabs } from "./SubjectDividerTabs";

type PedagogicalSubjectBrowserProps = {
  module: PedagogicalModuleKey;
  moduleLabel: string;
  documentTypeLabel: string;
  items: PedagogicalDocumentListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onImport: (prefill: { matiere: string; sousMatiere: string }) => void;
  onCreateManual?: () => void;
  onMoveSubject?: (id: string, matiere: string, sousMatiere: string) => void;
  onTrash?: (item: PedagogicalDocumentListItem) => void;
};

export function PedagogicalSubjectBrowser({
  module,
  moduleLabel,
  documentTypeLabel,
  items,
  selectedId,
  onSelect,
  onImport,
  onCreateManual,
  onMoveSubject,
  onTrash,
}: PedagogicalSubjectBrowserProps) {
  const navigation = useSubjectNavigation(module, items);

  const importLabel =
    navigation.activeMatierePrefill
      ? `Importer dans ${navigation.activeMatierePrefill}${
          navigation.activeSousMatierePrefill ? ` · ${navigation.activeSousMatierePrefill}` : ""
        }`
      : `Importer ${documentTypeLabel.toLowerCase()}`;

  const emptySubjectLabel =
    navigation.activeSubjectTab === SUBJECT_ALL
      ? moduleLabel
      : navigation.activeSubjectTab === SUBJECT_NONE
        ? "Sans matière"
        : subjectTabLabel(navigation.activeSubjectTab);

  return (
    <FloraCard padding="md" accent="cream">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-light text-flora-text-muted">
          {documentTypeLabel} enregistrés ({items.length})
        </p>
        <div className="flex flex-wrap gap-2">
          <FloraButton
            size="sm"
            onClick={() =>
              onImport({
                matiere: navigation.activeMatierePrefill,
                sousMatiere: navigation.activeSousMatierePrefill,
              })
            }
          >
            {importLabel}
          </FloraButton>
          {onCreateManual ? (
            <FloraButton size="sm" variant="secondary" onClick={onCreateManual}>
              Créer manuellement
            </FloraButton>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <SubjectDividerTabs
          tabs={navigation.tabs}
          activeTab={navigation.activeSubjectTab}
          counts={navigation.counts}
          onChange={navigation.setActiveSubjectTab}
          tabOrder={navigation.tabOrder}
          onReorder={navigation.reorderTabs}
        />
      </div>

      {navigation.subSubjectTabs.length > 1 ? (
        <div className="mt-3">
          <SubSubjectTabBar
            tabs={navigation.subSubjectTabs}
            activeTab={navigation.activeSubSubjectTab}
            onChange={navigation.setActiveSubSubjectTab}
          />
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {navigation.filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/70 bg-white/35 px-4 py-6 text-center">
            <p className="text-sm font-light text-flora-text-muted">
              Aucun document de {emptySubjectLabel} dans ce module.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <FloraButton
                size="sm"
                onClick={() =>
                  onImport({
                    matiere: navigation.activeMatierePrefill,
                    sousMatiere: navigation.activeSousMatierePrefill,
                  })
                }
              >
                {importLabel}
              </FloraButton>
              {onCreateManual ? (
                <FloraButton size="sm" variant="secondary" onClick={onCreateManual}>
                  Créer manuellement
                </FloraButton>
              ) : null}
            </div>
          </div>
        ) : (
          navigation.filteredItems.map((item) => (
            <PedagogicalDocumentCard
              key={item.id}
              item={{ ...item, documentType: item.documentType ?? documentTypeLabel }}
              selected={selectedId === item.id}
              onOpen={() => onSelect(item.id)}
              onTrash={onTrash ? () => onTrash(item) : undefined}
              onMoveSubject={
                onMoveSubject
                  ? (matiere, sousMatiere) => onMoveSubject(item.id, matiere, sousMatiere)
                  : undefined
              }
            />
          ))
        )}
      </div>
    </FloraCard>
  );
}
