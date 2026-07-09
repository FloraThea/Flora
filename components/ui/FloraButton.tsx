import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { accentClasses, buttons, surfaces, type FloraAccent } from "@/lib/theme";

type FloraButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type FloraButtonSize = "sm" | "md" | "lg";

export type FloraButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: FloraButtonVariant;
  accent?: FloraAccent;
  size?: FloraButtonSize;
  leadingIcon?: ReactNode;
};

const sizeClasses: Record<FloraButtonSize, string> = {
  sm: "gap-2 rounded-2xl px-3.5 py-2 text-xs",
  md: "gap-2.5 rounded-2xl px-5 py-3 text-sm",
  lg: "gap-3 rounded-3xl px-6 py-3.5 text-base",
};

const variantBase: Record<FloraButtonVariant, string> = {
  primary: buttons.primary,
  secondary: buttons.secondary,
  ghost: buttons.ghost,
  outline: buttons.outline,
};

export function FloraButton({
  variant = "primary",
  accent = "sage",
  size = "md",
  leadingIcon,
  className,
  children,
  ...props
}: FloraButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-normal backdrop-blur-sm",
        "transition-all duration-300 ease-out disabled:pointer-events-none disabled:opacity-50",
        surfaces.focusRing,
        sizeClasses[size],
        variantBase[variant],
        className,
      )}
      {...props}
    >
      {leadingIcon && (
        <span
          className={cn(
            "flex items-center justify-center rounded-xl",
            size === "sm" ? "h-6 w-6" : "h-7 w-7",
            variant === "primary"
              ? "bg-white/15 text-flora-text-inverse"
              : accentClasses[accent].bgMuted,
          )}
        >
          {leadingIcon}
        </span>
      )}
      {children}
    </button>
  );
}
