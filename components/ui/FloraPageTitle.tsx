import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { typography } from "@/lib/theme";

export type FloraPageTitleProps = HTMLAttributes<HTMLElement> & {
  title: string;
  subtitle?: string;
  meta?: string;
  action?: ReactNode;
};

export function FloraPageTitle({
  title,
  subtitle,
  meta,
  action,
  className,
  ...props
}: FloraPageTitleProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div>
        <h1 className={cn(typography.serif, "text-4xl font-medium tracking-tight text-flora-text")}>
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 text-base font-light text-flora-text-muted">{subtitle}</p>
        )}

        {meta && <p className="mt-1 text-sm font-light text-flora-text-subtle">{meta}</p>}
      </div>

      {action && <div className="shrink-0 self-start">{action}</div>}
    </header>
  );
}
