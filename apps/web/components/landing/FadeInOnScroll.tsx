"use client";

import { useInView } from "@/hooks/useInView";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface FadeInOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function FadeInOnScroll({
  children,
  className = "",
  delay = 0,
}: FadeInOnScrollProps) {
  const { ref, isInView } = useInView<HTMLDivElement>({
    threshold: 0.1,
    triggerOnce: true,
  });
  const reduceMotion = useReducedMotion();
  const animate = isInView && !reduceMotion;

  return (
    <div
      ref={ref}
      className={`${className}${animate ? " scroll-reveal" : ""}`}
      style={{
        // Server content stays readable before hydration and if scripts fail.
        animationDelay: `${Math.max(0, Math.min(150, delay))}ms`,
      }}
    >
      {children}
    </div>
  );
}
