import { FloraProgressBar } from "@/components/ui/FloraProgressBar";
import { TheaGlow } from "@/components/ui/TheaGlow";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/documents/import/config";
import { IMPORT_PROGRESS_STAGES } from "@/lib/documents/import/progress";
import type { ImportProgressStage } from "@/lib/documents/import/types";
import { colors } from "@/lib/theme";
import type { FileImportItem } from "../utils/import-manager";

type ProgressUploadProps = {
  items: FileImportItem[];
};

function stageIndex(stage: ImportProgressStage): number {
  return IMPORT_PROGRESS_STAGES.findIndex((entry) => entry.id === stage);
}

function ImportStageStepper({ currentStage }: { currentStage: ImportProgressStage }) {
  const activeIndex = Math.max(0, stageIndex(currentStage));

  return (
    <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {IMPORT_PROGRESS_STAGES.map((step, index) => {
        const isDone = index < activeIndex || currentStage === "completed";
        const isActive = index === activeIndex && currentStage !== "completed";
        const isFuture = index > activeIndex && currentStage !== "completed";

        return (
          <li
            key={step.id}
            className={cn(
              "rounded-2xl border px-2 py-2 text-center transition-colors",
              isDone && "border-sauge/30 bg-sauge/10 text-sauge",
              isActive && "border-sauge bg-white text-sauge shadow-sm",
              isFuture && "border-white/80 bg-white/40 text-[#9aa59a]",
            )}
          >
            <span className="block text-[10px] font-light uppercase tracking-wide">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProgressUpload({ items }: ProgressUploadProps) {
  const activeItems = items.filter((item) =>
    ["uploading", "analyzing", "success", "warning", "error"].includes(item.phase),
  );

  if (activeItems.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {activeItems.map((item) => {
        const isActive = item.phase === "uploading" || item.phase === "analyzing";

        return (
          <div
            key={item.id}
            className="rounded-3xl border border-white/70 bg-white/55 p-5 shadow-[0_2px_16px_rgba(0,0,0,0.025)] transition-all duration-300"
          >
            <div className="mb-4 flex items-center gap-4">
              <TheaGlow size="sm" pulse={isActive} title="" showFace={false} />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-light"
                  style={{ color: colors.charcoal.DEFAULT }}
                >
                  {item.statusLabel || "Import en cours…"}
                </p>
                <p
                  className="mt-1 truncate text-xs font-light"
                  style={{ color: colors.charcoal.faint }}
                >
                  {item.fileName} · {formatBytes(item.fileSize)}
                </p>
              </div>
              <span
                className={cn(
                  "font-serif text-lg",
                  item.phase === "success" && "text-sauge",
                  item.phase === "warning" && "text-[#c49a88]",
                  item.phase === "error" && "text-[#b88989]",
                )}
                style={{ color: colors.charcoal.subtle }}
              >
                {item.progress}%
              </span>
            </div>

            <ImportStageStepper currentStage={item.stage} />

            <FloraProgressBar
              value={item.progress}
              accent={
                item.phase === "error"
                  ? "peach"
                  : item.phase === "warning"
                    ? "peach"
                    : "sage"
              }
              size="md"
              className="mt-4"
            />

            {item.detailLine ? (
              <p
                className="mt-3 text-xs font-light"
                style={{ color: colors.charcoal.subtle }}
              >
                {item.detailLine}
              </p>
            ) : null}

            {item.speedLine ? (
              <p className="mt-1 text-xs font-light" style={{ color: colors.charcoal.faint }}>
                {item.speedLine}
              </p>
            ) : null}

            {item.phase === "uploading" && item.etaLine ? (
              <p className="mt-1 text-xs font-light" style={{ color: colors.charcoal.faint }}>
                {item.etaLine}
              </p>
            ) : null}

            {item.message ? (
              <p className="mt-3 text-xs font-light text-sauge">{item.message}</p>
            ) : null}

            {item.error ? (
              <p className="mt-3 whitespace-pre-wrap text-xs font-light text-[#b88989]">{item.error}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
