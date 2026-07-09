"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import type { ExportFormat, PrintCustomization, PrintStyleTheme } from "@/lib/timetable/export/types";
import { PRINT_STYLE_LABELS } from "@/lib/timetable/export/print-theme";

type PrintToolbarProps = {
  customization: PrintCustomization;
  onChange: (patch: Partial<PrintCustomization>) => void;
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
  error: string | null;
};

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl bg-white/40 px-3 py-2 text-sm text-flora-text">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded accent-[#9caf88]"
      />
    </label>
  );
}

export function PrintToolbar({
  customization,
  onChange,
  onExport,
  isExporting,
  error,
}: PrintToolbarProps) {
  return (
    <aside className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">Format</p>
        <div className="flex flex-wrap gap-2">
          {(["portrait", "landscape"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ orientation: value })}
              className={`rounded-full px-3 py-1.5 text-xs ${
                customization.orientation === value
                  ? "bg-sauge-light/50 text-flora-text"
                  : "bg-white/50 text-flora-text-muted"
              }`}
            >
              A4 {value === "portrait" ? "Portrait" : "Paysage"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">Thème</p>
        <div className="flex flex-col gap-1.5">
          {(Object.keys(PRINT_STYLE_LABELS) as PrintStyleTheme[]).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => onChange({ styleTheme: theme })}
              className={`rounded-2xl px-3 py-2 text-left text-sm ${
                customization.styleTheme === theme
                  ? "bg-white/75 text-flora-text"
                  : "bg-white/35 text-flora-text-muted"
              }`}
            >
              {PRINT_STYLE_LABELS[theme]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">
          Taille des cartes
        </p>
        <div className="flex flex-wrap gap-2">
          {(["compact", "normal", "comfortable"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ cardScale: value })}
              className={`rounded-full px-3 py-1.5 text-xs capitalize ${
                customization.cardScale === value
                  ? "bg-sauge-light/50 text-flora-text"
                  : "bg-white/50 text-flora-text-muted"
              }`}
            >
              {value === "compact" ? "Compact" : value === "normal" ? "Normal" : "Confortable"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">Polices</p>
        <div className="flex flex-wrap gap-2">
          {(["small", "normal", "large"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ fontScale: value })}
              className={`rounded-full px-3 py-1.5 text-xs ${
                customization.fontScale === value
                  ? "bg-sauge-light/50 text-flora-text"
                  : "bg-white/50 text-flora-text-muted"
              }`}
            >
              {value === "small" ? "Petite" : value === "normal" ? "Normale" : "Grande"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">
          Affichage
        </p>
        <div className="space-y-1.5">
          <ToggleRow
            label="Icônes"
            checked={customization.showIcons}
            onChange={(showIcons) => onChange({ showIcons })}
          />
          <ToggleRow
            label="Horaires"
            checked={customization.showTimes}
            onChange={(showTimes) => onChange({ showTimes })}
          />
          <ToggleRow
            label="Objectifs"
            checked={customization.showObjectives}
            onChange={(showObjectives) => onChange({ showObjectives })}
          />
          <ToggleRow
            label="Compétences"
            checked={customization.showCompetencies}
            onChange={(showCompetencies) => onChange({ showCompetencies })}
          />
          <ToggleRow
            label="Texte complémentaire"
            checked={customization.showComplementaryText}
            onChange={(showComplementaryText) => onChange({ showComplementaryText })}
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-white/50 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-flora-text-muted">Exporter</p>
        <FloraButton
          accent="sage"
          variant="primary"
          size="sm"
          className="w-full justify-center"
          disabled={isExporting}
          onClick={() => onExport("pdf")}
        >
          Export PDF
        </FloraButton>
        <FloraButton
          accent="sage"
          variant="secondary"
          size="sm"
          className="w-full justify-center"
          disabled={isExporting}
          onClick={() => onExport("png")}
        >
          Export PNG HD
        </FloraButton>
        <FloraButton
          accent="cream"
          variant="secondary"
          size="sm"
          className="w-full justify-center"
          disabled={isExporting}
          onClick={() => onExport("jpeg")}
        >
          Export JPEG
        </FloraButton>
        <FloraButton
          accent="lavender"
          variant="secondary"
          size="sm"
          className="w-full justify-center"
          disabled={isExporting}
          onClick={() => onExport("print")}
        >
          Impression directe
        </FloraButton>
      </div>

      {error ? <p className="text-xs text-[#b88989]">{error}</p> : null}
    </aside>
  );
}
