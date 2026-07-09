import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import {
  accentClasses,
  typography,
  type FloraAccent,
} from "@/lib/theme";

export type FloraStatCardProps = HTMLAttributes<HTMLElement> & {
  value: string | number;
  label: string;
  accent?: FloraAccent;
};

export function FloraStatCard({
  value,
  label,
  accent = "rose",
  className,
  ...props
}: FloraStatCardProps) {
  const styles = accentClasses[accent];

  return (
    <article
      className={cn(
        "rounded-[1.75rem] border border-rose-soft/50 bg-cream-rose p-5 shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    >
      <p className={cn(typography.serif, "text-3xl font-medium", styles.text)}>
        {value}
      </p>
      <p className="mt-1.5 text-sm font-light leading-snug text-flora-text-muted">{label}</p>
      <span className={cn("mt-4 inline-block h-1 w-6 rounded-full opacity-50", styles.dot)} />
    </article>
  );
}
