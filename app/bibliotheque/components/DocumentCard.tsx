import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import {
  formatDocumentDate,
  formatDocumentTypeLabel,
  type FloraDocument,
} from "@/lib/documents/types";
import { colors } from "@/lib/theme";
import { getDocumentIcon } from "./document-icons";

type DocumentCardProps = {
  document: FloraDocument;
  onClick: () => void;
};

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const icon = getDocumentIcon(document);
  const isAnalysed = document.status === "analysed";

  return (
    <FloraCard
      padding="md"
      hoverable
      accent="cream"
      className="cursor-pointer"
      onClick={onClick}
    >
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lavande-light/35 text-2xl">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <h3
              className="font-serif text-xl font-medium leading-snug"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              {document.title || document.original_filename}
            </h3>
            {isAnalysed && (
              <FloraBadge accent="sage" size="sm">
                Analyse terminée
              </FloraBadge>
            )}
          </div>

          <p className="text-xs font-light" style={{ color: colors.charcoal.faint }}>
            {formatDocumentDate(document.created_at)}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {document.document_type && (
          <FloraBadge accent="lavender" size="sm">
            {formatDocumentTypeLabel(document.document_type)}
          </FloraBadge>
        )}
        {document.matiere && (
          <FloraBadge accent="rose" size="sm">
            {document.matiere}
          </FloraBadge>
        )}
        {document.sous_matiere && (
          <FloraBadge accent="peach" size="sm">
            {document.sous_matiere}
          </FloraBadge>
        )}
        {document.niveau && (
          <FloraBadge accent="sage" size="sm">
            {document.niveau}
          </FloraBadge>
        )}
      </div>

      {document.methode && (
        <p className="mb-3 text-xs font-light" style={{ color: colors.charcoal.faint }}>
          Méthode : {document.methode}
        </p>
      )}

      <p
        className="line-clamp-3 text-sm font-light leading-relaxed"
        style={{ color: colors.charcoal.muted }}
      >
        {document.resume || "Résumé en attente d'analyse."}
      </p>
    </FloraCard>
  );
}
