import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { accentClasses, surfaces, type FloraAccent } from "@/lib/theme";

export type FloraCardProps = HTMLAttributes<HTMLElement> & {
  accent?: FloraAccent;
  variant?: "rose" | "white";
  hoverable?: boolean;
  padding?: "sm" | "md" | "lg";
  children: ReactNode;
};

const paddingClasses = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function FloraCard({
  accent,
  variant = "rose",
  hoverable = false,
  padding = "md",
  className,
  children,
  ...props
}: FloraCardProps) {
  const accentStyle = accent ? accentClasses[accent] : null;

  return (
    <article
      className={cn(
        variant === "white" ? surfaces.cardWhite : surfaces.card,
        paddingClasses[padding],
        accent && "border-l-[3px]",
        accentStyle?.cardAccent,
        hoverable && surfaces.cardHover,
        hoverable && "cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}
