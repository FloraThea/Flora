import { useRef } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { TheaGlow } from "@/components/ui/TheaGlow";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/documents/types";
import { UNIFIED_ACCEPTED_EXTENSIONS } from "@/lib/library/types";
import { MAX_UPLOAD_SIZE } from "@/lib/upload/max-upload-size";
import { colors } from "@/lib/theme";

type UploadZoneProps = {
  selectedFiles: File[];
  isDragging: boolean;
  isUploading: boolean;
  onDragStateChange: (isDragging: boolean) => void;
  onFilesSelected: (files: File[]) => void;
  onImportClick: () => void;
};

export function UploadZone({
  selectedFiles,
  isDragging,
  isUploading,
  onDragStateChange,
  onFilesSelected,
  onImportClick,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null | undefined) => {
    if (!fileList?.length) return;
    onFilesSelected(Array.from(fileList));
  };

  return (
    <FloraCard padding="lg" accent="rose">
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <TheaGlow size="sm" pulse={isUploading} title="" />
          <div>
            <h2
              className="font-serif text-2xl font-medium"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              Importer un document
            </h2>
            <p
              className="mt-2 text-sm font-light leading-relaxed"
              style={{ color: colors.charcoal.subtle }}
            >
              Déposez vos référentiels BO, guides, méthodes, programmations ou ressources personnelles.
              Flora détecte le type de document et lance l&apos;analyse automatique.
            </p>
          </div>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            onDragStateChange(true);
          }}
          onDragLeave={() => onDragStateChange(false)}
          onDrop={(event) => {
            event.preventDefault();
            onDragStateChange(false);
            handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "rounded-[2rem] border border-dashed px-6 py-12 text-center transition-all duration-300",
            isDragging
              ? "scale-[1.01] border-rose-poudre/70 bg-rose-soft/30"
              : "border-rose-soft/60 bg-white/40",
          )}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-lavande-light/40">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-[#9a8ab0]" aria-hidden>
              <path
                d="M12 16V8m0 0 4-4m-4 4 4 4M5 18h14a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p
            className="mt-5 font-serif text-2xl font-medium"
            style={{ color: colors.charcoal.DEFAULT }}
          >
            Glissez-déposez vos documents ici
          </p>
          <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
            PDF · DOCX · XLSX · CSV · PPTX · Images · TXT — jusqu&apos;à {Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))} Mo
          </p>

          {selectedFiles.length > 0 ? (
            <div className="mx-auto mt-5 flex max-w-lg flex-col items-center gap-2">
              {selectedFiles.map((file) => (
                <div key={`${file.name}-${file.size}`} className="flex flex-col items-center gap-1">
                  <FloraBadge accent="lavender">{file.name}</FloraBadge>
                  <span className="text-xs font-light" style={{ color: colors.charcoal.faint }}>
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-xs font-light" style={{ color: colors.charcoal.faint }}>
              Aucun fichier sélectionné
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={UNIFIED_ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <FloraButton
            accent="rose"
            variant="secondary"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            Choisir des fichiers
          </FloraButton>
          <FloraButton
            accent="sage"
            disabled={selectedFiles.length === 0 || isUploading}
            onClick={onImportClick}
            leadingIcon={
              isUploading ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sauge/30 border-t-sauge" />
              ) : undefined
            }
          >
            Importer
          </FloraButton>
        </div>
      </div>
    </FloraCard>
  );
}
