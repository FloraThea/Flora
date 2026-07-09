import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { colors, typography } from "@/lib/theme";
import { FloraCard } from "./FloraCard";

export type TheaGlowProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  message?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  showFace?: boolean;
  children?: ReactNode;
};

const orbSizes = {
  sm: { orb: "h-10 w-10", halo: "h-14 w-14", ring1: "h-[130%] w-[130%]", ring2: "h-[155%] w-[155%]", particle: 3 },
  md: { orb: "h-20 w-20", halo: "h-28 w-28", ring1: "h-[135%] w-[135%]", ring2: "h-[165%] w-[165%]", particle: 5 },
  lg: { orb: "h-28 w-28", halo: "h-40 w-40", ring1: "h-[140%] w-[140%]", ring2: "h-[175%] w-[175%]", particle: 8 },
};

const particleOffsets = [
  { top: "6%", left: "82%", delay: "0s", size: "4px" },
  { top: "78%", left: "8%", delay: "1.2s", size: "3px" },
  { top: "18%", left: "-4%", delay: "2.4s", size: "3px" },
  { top: "52%", left: "94%", delay: "0.8s", size: "3px" },
  { top: "-2%", left: "48%", delay: "1.8s", size: "3px" },
  { top: "90%", left: "58%", delay: "3s", size: "4px" },
  { top: "35%", left: "98%", delay: "2s", size: "2px" },
  { top: "65%", left: "-2%", delay: "1.5s", size: "3px" },
];

const sparkleOffsets = [
  { top: "10%", left: "20%", delay: "0s" },
  { top: "25%", left: "85%", delay: "1s" },
  { top: "70%", left: "15%", delay: "2s" },
  { top: "80%", left: "75%", delay: "0.5s" },
];

function LuminousOrb({
  size,
  pulse,
  showFace = true,
}: {
  size: "sm" | "md" | "lg";
  pulse: boolean;
  showFace?: boolean;
}) {
  const config = orbSizes[size];
  const particles = particleOffsets.slice(0, config.particle);
  const sparkles = sparkleOffsets.slice(0, size === "lg" ? 4 : 2);

  return (
    <div className={cn("thea-nebula-wrap shrink-0", config.halo)} aria-hidden>
      <div className={cn("thea-nebula-halo", config.halo)} />
      <div className={cn("thea-orbit-ring thea-orbit-ring-2", config.ring2)} />
      <div className={cn("thea-orbit-ring", config.ring1)} />
      {sparkles.map((sparkle, index) => (
        <span
          key={`sparkle-${index}`}
          className="thea-sparkle"
          style={{ top: sparkle.top, left: sparkle.left, animationDelay: sparkle.delay }}
        >
          ✦
        </span>
      ))}
      {particles.map((particle, index) => (
        <span
          key={index}
          className="thea-particle"
          style={{
            top: particle.top,
            left: particle.left,
            width: particle.size,
            height: particle.size,
            animationDelay: particle.delay,
          }}
        />
      ))}
      <div className={cn("thea-orb relative rounded-full", config.orb, pulse && "thea-orb-pulse")}>
        <span className="thea-orb-shine" />
        {showFace && size !== "sm" ? (
          <span className="thea-face">
            <span className="thea-eye thea-eye-left" />
            <span className="thea-eye thea-eye-right" />
            <span className="thea-smile" />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TheaGlow({
  title,
  message,
  size = "md",
  pulse = true,
  showFace = true,
  children,
  className,
  ...props
}: TheaGlowProps) {
  const glowOnly = !title && !message && !children;

  if (glowOnly) {
    return (
      <div className={cn("relative shrink-0", className)} {...props}>
        <LuminousOrb size={size} pulse={pulse} showFace={showFace} />
      </div>
    );
  }

  return (
    <FloraCard accent="rose" padding="lg" className={cn("relative overflow-hidden text-center", className)} {...props}>
      <div className="flex flex-col items-center gap-5">
        <LuminousOrb size={size} pulse={pulse} showFace={showFace} />

        {title && (
          <h3 className={cn(typography.serif, "flex items-center gap-2 text-2xl font-medium text-flora-text")}>
            {title}
            <span aria-hidden>🌿</span>
          </h3>
        )}
        {message && (
          <p className="max-w-xs text-sm font-light leading-relaxed text-flora-text-muted">{message}</p>
        )}
        {children}
      </div>
    </FloraCard>
  );
}

export function TheaHeroPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <TheaGlow
      size="lg"
      pulse
      title="Théa"
      message="Votre assistante pédagogique est à vos côtés."
      className={className}
      {...props}
    >
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-2 rounded-[1.25rem] border border-sauge-strong/20 bg-sauge-strong px-6 py-3 text-sm font-normal text-flora-text-inverse shadow-[var(--shadow-button)] transition hover:bg-sauge active:scale-[0.98]"
      >
        Discuter avec Théa
        <span aria-hidden>✨</span>
      </button>
    </TheaGlow>
  );
}
