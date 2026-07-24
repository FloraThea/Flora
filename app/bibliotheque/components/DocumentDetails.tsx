import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { getListKey } from "@/lib/list-keys";
import {
  formatDocumentDate,
  formatDocumentStatusLabel,
  formatDocumentTypeLabel,
  formatFileSize,
  type DocumentWithRelations,
} from "@/lib/documents/types";
import { colors } from "@/lib/theme";
import { DocumentHierarchyView } from "./DocumentHierarchyView";
import { getDocumentIcon } from "./document-icons";

type DocumentDetailsProps = {
  document: DocumentWithRelations;
  onClose: () => void;
  onArchive: () => void;
  isArchiving: boolean;
};

function MetadataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3">
      <p
        className="text-[11px] font-medium tracking-[0.12em] uppercase"
        style={{ color: colors.charcoal.label }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-sm font-light"
        style={{ color: colors.charcoal.DEFAULT }}
      >
        {value || "—"}
      </p>
    </div>
  );
}

export function DocumentDetails({
  document,
  onClose,
  onArchive,
  isArchiving,
}: DocumentDetailsProps) {
  const pedagogicalEntities = document.pedagogical_entities ?? [];
  const hasFaithfulHierarchy = pedagogicalEntities.some(
    (entity) => entity.entity_type === "module" || entity.entity_type === "seance",
  );
  const extractionMethod = String(document.metadata?.extraction_method ?? "");

  return (
    <FloraCard padding="lg" accent="lavender" className="border-lavande-light/60">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-3xl">
            {getDocumentIcon(document)}
          </div>
          <div>
            <h2
              className="font-serif text-2xl font-medium"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              {document.title || document.original_filename}
            </h2>
            <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
              {formatDocumentTypeLabel(document.document_type)} ·{" "}
              {formatDocumentStatusLabel(document.status)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <FloraButton accent="cream" variant="ghost" onClick={onClose}>
            Fermer
          </FloraButton>
          <FloraButton
            accent="rose"
            variant="outline"
            disabled={isArchiving}
            onClick={() => {
              if (
                !window.confirm(
                  "Supprimer ce document et son analyse ? Cette action est définitive.",
                )
              ) {
                return;
              }
              onArchive();
            }}
          >
            {isArchiving ? "Suppression…" : "Supprimer le document"}
          </FloraButton>
        </div>
      </div>

      <section className="mb-8">
        <h3
          className="mb-3 font-serif text-xl font-medium"
          style={{ color: colors.charcoal.DEFAULT }}
        >
          Résumé
        </h3>
        <p
          className="rounded-2xl border border-white/70 bg-white/45 px-4 py-4 text-sm font-light leading-relaxed"
          style={{ color: colors.charcoal.muted }}
        >
          {document.resume || "Aucun résumé disponible pour ce document."}
        </p>
      </section>

      <section className="mb-8">
        <h3
          className="mb-3 font-serif text-xl font-medium"
          style={{ color: colors.charcoal.DEFAULT }}
        >
          Métadonnées
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MetadataField label="Type" value={document.document_type} />
          <MetadataField label="Matière" value={document.matiere} />
          <MetadataField label="Sous-matière" value={document.sous_matiere} />
          <MetadataField label="Niveau" value={document.niveau} />
          <MetadataField label="Cycle" value={document.cycle} />
          <MetadataField label="Méthode" value={document.methode} />
          <MetadataField label="Auteur" value={document.auteur} />
          <MetadataField label="Éditeur" value={document.editeur} />
          <MetadataField label="Année" value={document.annee} />
        </div>
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h3
            className="mb-3 font-serif text-xl font-medium"
            style={{ color: colors.charcoal.DEFAULT }}
          >
            Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {document.document_tags.length > 0 ? (
              document.document_tags.map((tag, index) => (
                <FloraBadge
                  key={getListKey(tag.id, [tag.tag, tag.document_id], index, "tag")}
                  accent="peach"
                >
                  {tag.tag}
                </FloraBadge>
              ))
            ) : (
              <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
                Aucun tag détecté.
              </p>
            )}
          </div>
        </section>

        <section>
          <h3
            className="mb-3 font-serif text-xl font-medium"
            style={{ color: colors.charcoal.DEFAULT }}
          >
            Compétences détectées
          </h3>
          <div className="flex flex-col gap-2">
            {document.document_competences.length > 0 ? (
              document.document_competences.map((item, index) => (
                <div
                  key={getListKey(
                    item.id,
                    [item.code_bo, item.competence, item.niveau],
                    index,
                    "competence",
                  )}
                  className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3"
                >
                  <p className="text-sm font-light" style={{ color: colors.charcoal.DEFAULT }}>
                    {item.competence}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.code_bo && (
                      <FloraBadge accent="lavender" size="sm">
                        {item.code_bo}
                      </FloraBadge>
                    )}
                    {item.niveau && (
                      <FloraBadge accent="sage" size="sm">
                        {item.niveau}
                      </FloraBadge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
                Aucune compétence détectée.
              </p>
            )}
          </div>
        </section>
      </div>

      {hasFaithfulHierarchy ? (
        <DocumentHierarchyView
          entities={pedagogicalEntities}
          extractionMethod={extractionMethod}
        />
      ) : null}

      <section className="mb-8">
        <h3
          className="mb-3 font-serif text-xl font-medium"
          style={{ color: colors.charcoal.DEFAULT }}
        >
          {hasFaithfulHierarchy ? "Sections indexées" : "Sections du document"}
        </h3>
        <div className="flex flex-col gap-3">
          {document.document_chunks.length > 0 ? (
            document.document_chunks.map((chunk, index) => (
              <article
                key={getListKey(
                  chunk.id,
                  [chunk.document_id, chunk.chunk_index, chunk.title],
                  index,
                  "chunk",
                )}
                className="rounded-2xl border border-white/70 bg-white/45 px-4 py-4"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p
                    className="font-serif text-lg font-medium"
                    style={{ color: colors.charcoal.DEFAULT }}
                  >
                    {chunk.title || `Section ${chunk.chunk_index + 1}`}
                  </p>
                  {chunk.section_type && (
                    <FloraBadge accent="cream" size="sm">
                      {chunk.section_type}
                    </FloraBadge>
                  )}
                </div>
                <p
                  className="line-clamp-5 text-sm font-light leading-relaxed"
                  style={{ color: colors.charcoal.muted }}
                >
                  {chunk.content}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
              Aucune section disponible.
            </p>
          )}
        </div>
      </section>

      <section>
        <h3
          className="mb-3 font-serif text-xl font-medium"
          style={{ color: colors.charcoal.DEFAULT }}
        >
          Informations techniques
        </h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetadataField label="Fichier" value={document.original_filename} />
          <MetadataField label="Extension" value={document.file_extension.toUpperCase()} />
          <MetadataField label="Taille" value={formatFileSize(document.file_size)} />
          <MetadataField label="Importé le" value={formatDocumentDate(document.created_at)} />
          <MetadataField label="Stockage" value={document.storage_path} />
          <MetadataField label="Statut" value={formatDocumentStatusLabel(document.status)} />
        </div>
      </section>
    </FloraCard>
  );
}
