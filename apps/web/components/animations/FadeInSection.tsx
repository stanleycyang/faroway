'use client';

import { useInView } from '@/hooks';

interface FadeInSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Wrapper component that fades in content when it enters the viewport
 * Uses intersection observer for performance
 */
export function FadeInSection({ children, delay = 0, className = '' }: FadeInSectionProps) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.1, triggerOnce: true });

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

interface SlideInSectionProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  className?: string;
}

export function SlideInSection({ 
  children, 
  direction = 'up', 
  delay = 0, 
  className = '' 
}: SlideInSectionProps) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.1, triggerOnce: true });

  const getTransform = () => {
    if (isInView) return 'translate(0, 0)';
    
    switch (direction) {
      case 'left':
        return 'translateX(-40px)';
      case 'right':
        return 'translateX(40px)';
      case 'down':
        return 'translateY(-40px)';
      case 'up':
      default:
        return 'translateY(40px)';
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isInView ? 1 : 0,
        transform: getTransform(),
        transition: `opacity 0.8s ease-out ${delay}s, transform 0.8s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
