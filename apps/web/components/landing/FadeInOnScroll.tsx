interface FadeInOnScrollProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Reveal on scroll with a CSS view timeline so the landing page does not
 * hydrate an observer per section. Content stays readable when the browser
 * has no view timeline or the traveler prefers reduced motion.
 */
export function FadeInOnScroll({
  children,
  className = "",
  delay = 0,
}: FadeInOnScrollProps) {
  const stagger = Math.max(0, Math.min(150, delay));
  return (
    <div
      className={`${className} scroll-reveal-on-view`}
      style={stagger ? { animationDelay: `${stagger}ms` } : undefined}
    >
      {children}
    </div>
  );
}
