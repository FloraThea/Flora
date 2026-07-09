import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { colors } from "@/lib/theme";

export type FloraSidebarSectionProps = HTMLAttributes<HTMLElement> & {
  title: string;
  children: ReactNode;
};

export function FloraSidebarSection({
  title,
  children,
  className,
  ...props
}: FloraSidebarSectionProps) {
  return (
    <section className={cn("flex flex-col", className)} {...props}>
      <p
        className="mb-2 px-3 text-[11px] font-medium tracking-[0.14em] uppercase"
        style={{ color: colors.charcoal.label }}
      >
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </section>
  );
}
