import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import { formatFileSize } from "@/lib/documents/types";
import type { UnifiedLibraryItem } from "@/lib/library/types";
import { colors } from "@/lib/theme";

type LibraryItemCardProps = {
  item: UnifiedLibraryItem;
  onClick: () => void;
};

function getLibraryIcon(item: UnifiedLibraryItem): string {
  if (item.category === "Référentiel BO") return "📘";
  if (item.category === "Guide enseignant" || item.category === "Méthode") return "📗";
  if (item.category === "Programmation" || item.category === "Progression") return "📋";
  if (item.category === "Séquence") return "📝";
  if (item.format === "PDF") return "📄";
  if (["XLSX", "XLS", "CSV"].includes(item.format)) return "📊";
  if (["PNG", "JPG", "JPEG", "WEBP", "GIF"].includes(item.format)) return "🖼️";
  return "📚";
}
export function LibraryItemCard({ item, onClick }: LibraryItemCardProps) {
  const icon = getLibraryIcon(item);

  return (
    <FloraCard padding="md" hoverable accent="cream" className="cursor-pointer" onClick={onClick}>
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-lavande-light/35 text-2xl">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-serif text-xl font-medium leading-snug" style={{ color: colors.charcoal.DEFAULT }}>
              {item.title}
            </h3>
            {item.isActiveReferentiel ? (
              <FloraBadge accent="sage" size="sm">
                Actif
              </FloraBadge>
            ) : null}
          </div>
          <p className="text-xs font-light" style={{ color: colors.charcoal.faint }}>
            {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(
              new Date(item.createdAt),
            )}
            {item.fileSize > 0 ? ` · ${formatFileSize(item.fileSize)}` : ""}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FloraBadge accent={item.category === "Référentiel BO" ? "sage" : "lavender"} size="sm">
          {item.category}
        </FloraBadge>
        {item.discipline ? <FloraBadge accent="rose" size="sm">{item.discipline}</FloraBadge> : null}
        {item.niveau ? <FloraBadge accent="sage" size="sm">{item.niveau}</FloraBadge> : null}
        {item.format ? <FloraBadge accent="cream" size="sm">{item.format}</FloraBadge> : null}
      </div>

      <p className="mb-2 text-xs font-light" style={{ color: colors.charcoal.faint }}>
        {item.analysisStatus}
        {item.competenceCount > 0 ? ` · ${item.competenceCount} compétence(s)` : ""}
      </p>

      <p className="line-clamp-3 text-sm font-light leading-relaxed" style={{ color: colors.charcoal.muted }}>
        {item.resume || "Document importé — analyse en attente ou limitée."}
      </p>
    </FloraCard>
  );
}
