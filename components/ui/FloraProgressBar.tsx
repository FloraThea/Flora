import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { accentClasses, type FloraAccent } from "@/lib/theme";

export type FloraProgressBarProps = HTMLAttributes<HTMLDivElement> & {
  value: number;
  accent?: FloraAccent;
  showLabel?: boolean;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "h-1.5",
  md: "h-2",
};

export function FloraProgressBar({
  value,
  accent = "rose",
  showLabel = false,
  size = "md",
  className,
  ...props
}: FloraProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const styles = accentClasses[accent];

  return (
    <div className={cn("w-full", className)} {...props}>
      {showLabel && (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-light text-flora-text-subtle">Progression</span>
          <span className={cn("text-sm font-light", styles.text)}>
            {clamped}%
          </span>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-full bg-white/60",
          sizeClasses[size],
        )}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full opacity-70 transition-all duration-500 ease-out",
            styles.progress,
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
