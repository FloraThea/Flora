import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { accentClasses, typography, type FloraAccent } from "@/lib/theme";

export type FloraDashboardCardProps = HTMLAttributes<HTMLElement> & {
  title: string;
  value: string;
  detail?: string;
  href?: string;
  actionLabel?: string;
  icon?: ReactNode;
  accent?: FloraAccent;
};

export function FloraDashboardCard({
  title,
  value,
  detail,
  href,
  actionLabel,
  icon,
  accent = "rose",
  className,
  ...props
}: FloraDashboardCardProps) {
  const styles = accentClasses[accent];

  const content = (
    <article
      className={cn(
        "flex h-full flex-col rounded-[1.75rem] border border-rose-soft/50 bg-cream-rose p-5 shadow-[var(--shadow-card)] transition duration-300",
        href && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]",
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            styles.iconCircle,
          )}
        >
          {icon}
        </span>
      </div>

      <h3 className={cn(typography.serif, "text-lg font-medium text-flora-text")}>{title}</h3>
      <p className="mt-2 text-sm font-medium text-flora-text">{value}</p>
      {detail ? (
        <p className="mt-1 text-xs font-light text-flora-text-subtle">{detail}</p>
      ) : null}

      {actionLabel ? (
        <span
          className={cn(
            "mt-auto inline-flex w-fit items-center gap-1 rounded-2xl px-3 py-2 text-xs font-light transition",
            styles.bgMuted,
            "text-flora-text-muted",
          )}
        >
          {actionLabel}
          <span aria-hidden>→</span>
        </span>
      ) : null}
    </article>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
