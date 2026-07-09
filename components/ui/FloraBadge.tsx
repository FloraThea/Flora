import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { accentClasses, type FloraAccent } from "@/lib/theme";

export type FloraBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  accent?: FloraAccent;
  size?: "sm" | "md";
  children: ReactNode;
};

const sizeClasses = {
  sm: "rounded-lg px-2 py-0.5 text-[10px]",
  md: "rounded-xl px-3 py-1 text-xs",
};

export function FloraBadge({
  accent = "rose",
  size = "md",
  className,
  children,
  ...props
}: FloraBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-light tracking-wide",
        sizeClasses[size],
        accentClasses[accent].badge,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
