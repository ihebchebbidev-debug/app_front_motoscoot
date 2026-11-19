import React from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

interface RevealProps {
  children: React.ReactNode;
  animation?: 'fade-in-up' | 'fade-in-left' | 'fade-in-right' | 'scale-in';
  delay?: number;
  duration?: number;
  className?: string;
}

/**
 * Reveal - Wrapper pour micro-interactions au scroll.
 * Parfait pour dynamiser les grilles d'annonces.
 */
export const Reveal: React.FC<RevealProps> = ({ 
  children, 
  animation = 'fade-in-up', 
  delay = 0, 
  duration = 700,
  className = ''
}) => {
  const { elementRef, isVisible } = useIntersectionObserver();

  const animationStyles = {
    'fade-in-up': isVisible 
      ? 'opacity-100 translate-y-0' 
      : 'opacity-0 translate-y-8',
    'fade-in-left': isVisible 
      ? 'opacity-100 translate-x-0' 
      : 'opacity-0 -translate-x-8',
    'fade-in-right': isVisible 
      ? 'opacity-100 translate-x-0' 
      : 'opacity-0 translate-x-8',
    'scale-in': isVisible 
      ? 'opacity-100 scale-100' 
      : 'opacity-0 scale-95',
  };

  // Only opacity and transform move (it used to animate every property). With the
  // phone's « reduce motion » setting: no movement, a short fade, no
  // stagger — the 700 ms slide of every tile ignored it.
  return (
    <div
      // @ts-ignore - elementRef est typé de manière générique
      ref={elementRef}
      className={`transition-[opacity,transform] [transition-duration:var(--reveal-ms)] [transition-delay:var(--reveal-delay)] motion-reduce:transform-none motion-reduce:[transition-duration:150ms] motion-reduce:[transition-delay:0ms] ${className} ${animationStyles[animation]}`}
      style={{
        ['--reveal-ms' as string]: `${duration}ms`,
        ['--reveal-delay' as string]: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
};